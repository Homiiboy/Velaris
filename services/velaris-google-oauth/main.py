"""Private Velaris YouTube OAuth bridge. All Google credentials stay server-side."""
import asyncio
import base64
import hashlib
import json
import os
import re
import secrets
import time
from pathlib import Path
from urllib.parse import urlencode

import httpx
from cryptography.fernet import Fernet, InvalidToken
from fastapi import FastAPI, Header, HTTPException, Query
from fastapi.responses import HTMLResponse, RedirectResponse

app = FastAPI(title="Velaris YouTube OAuth", docs_url=None, redoc_url=None, openapi_url=None)
DATA = Path(os.environ.get("STATE_DIR", "/data"))
CFG = json.loads(Path(os.environ.get("GOOGLE_OAUTH_FILE", "/run/secrets/google-oauth.json")).read_text())["web"]
CLIENT_ID = CFG["client_id"]
CLIENT_SECRET = CFG["client_secret"]
REDIRECT = "https://zimaos.tailbcd9a8.ts.net/api/youtube/oauth/callback"
if REDIRECT not in CFG.get("redirect_uris", []):
    raise RuntimeError("Google OAuth client redirect_uris must include " + REDIRECT)
JF = os.environ.get("JELLYFIN_URL", "http://host.docker.internal:8097").rstrip("/")
SCOPE = "https://www.googleapis.com/auth/youtube.readonly"
STATES = {}
CACHE = {}
DATA.mkdir(exist_ok=True, parents=True)
key_path = DATA / "fernet.key"
if not key_path.exists():
    # Exclusive creation avoids key overwrite, which would invalidate saved tokens.
    with key_path.open("xb") as fp:
        os.chmod(key_path, 0o600)
        fp.write(Fernet.generate_key())
CRYPT = Fernet(key_path.read_bytes())


def user_path(user_id: str) -> Path:
    if not re.fullmatch(r"[0-9a-fA-F-]{32,36}", user_id):
        raise HTTPException(400, "Invalid Jellyfin user ID")
    return DATA / ("account-" + user_id.lower() + ".bin")


def read_tokens(user_id: str) -> dict | None:
    target = user_path(user_id)
    if not target.exists():
        return None
    try:
        return json.loads(CRYPT.decrypt(target.read_bytes()))
    except (InvalidToken, ValueError):
        raise HTTPException(503, "Stored Google authorization cannot be decoded")


def save_tokens(user_id: str, value: dict) -> None:
    target = user_path(user_id)
    temp = target.with_name(target.name + "." + secrets.token_hex(5) + ".tmp")
    with temp.open("xb") as fp:
        os.chmod(temp, 0o600)
        fp.write(CRYPT.encrypt(json.dumps(value).encode()))
    os.replace(temp, target)
    CACHE.pop(user_id, None)


async def authorized_user(token: str | None) -> str:
    if not token or len(token) > 1000:
        raise HTTPException(401, "Jellyfin login required")
    header = {
        "Authorization": 'MediaBrowser Client="Velaris Google OAuth", Device="Server", DeviceId="velaris-google-oauth", Version="1.0", Token="' + token + '"'
    }
    try:
        async with httpx.AsyncClient(timeout=12) as client:
            response = await client.get(JF + "/Users/Me", headers=header)
        if response.status_code != 200:
            raise HTTPException(401, "Jellyfin session invalid")
        user = response.json()
        return str(user["Id"])
    except (httpx.HTTPError, KeyError, ValueError) as exc:
        raise HTTPException(502, "Jellyfin authentication unavailable") from exc


def verifier_challenge() -> tuple[str, str]:
    verifier = secrets.token_urlsafe(48)
    digest = hashlib.sha256(verifier.encode()).digest()
    return verifier, base64.urlsafe_b64encode(digest).decode().rstrip("=")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "velaris-google-oauth"}


@app.post("/oauth/start")
async def begin(x_velaris_jellyfin_token: str | None = Header(default=None)):
    uid = await authorized_user(x_velaris_jellyfin_token)
    now = time.time()
    for k, record in list(STATES.items()):
        if now - record["created"] > 600:
            STATES.pop(k, None)
    state = secrets.token_urlsafe(32)
    verifier, challenge = verifier_challenge()
    STATES[state] = {"user": uid, "verifier": verifier, "created": now}
    params = {
        "client_id": CLIENT_ID,
        "redirect_uri": REDIRECT,
        "response_type": "code",
        "scope": SCOPE,
        "access_type": "offline",
        "prompt": "consent",
        "state": state,
        "code_challenge": challenge,
        "code_challenge_method": "S256",
    }
    return {"authorizationUrl": "https://accounts.google.com/o/oauth2/v2/auth?" + urlencode(params)}


def done_page(message: str, ok: bool) -> HTMLResponse:
    # Final page has no authorization code and loads no external resources.
    heading = "YouTube-Konto verbunden" if ok else "Anmeldung fehlgeschlagen"
    text = message.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    return HTMLResponse(
        '<!doctype html><html lang="de"><head><meta charset="utf-8">'
        '<meta name="referrer" content="no-referrer"><meta name="viewport" content="width=device-width">'
        '<title>Velaris Google Anmeldung</title><style>body{background:#08080d;color:#fff;'
        'font:16px system-ui;display:grid;place-items:center;min-height:90vh;text-align:center}'
        'main{max-width:500px;padding:25px}h1{color:#ff0033}</style></head><body><main>'
        '<h1>' + heading + '</h1><p>' + text + '</p><p>Dieses Fenster kannst du schließen. '
        'Öffne Velaris YouTube und aktualisiere die For You Seite.</p>'
        '</main></body></html>', headers={"Cache-Control": "no-store", "Referrer-Policy": "no-referrer"}
    )


@app.get("/oauth/callback")
async def callback(state: str = Query(default=""), code: str = Query(default=""), error: str = Query(default="")):
    record = STATES.pop(state, None)
    if not record or time.time() - record["created"] > 600:
        return RedirectResponse(url="/oauth/done?result=expired", status_code=303,
                                headers={"Cache-Control": "no-store", "Referrer-Policy": "no-referrer"})
    if error or not code:
        return RedirectResponse(url="/oauth/done?result=denied", status_code=303,
                                headers={"Cache-Control": "no-store", "Referrer-Policy": "no-referrer"})
    try:
        async with httpx.AsyncClient(timeout=25) as client:
            response = await client.post("https://oauth2.googleapis.com/token", data={
                "client_id": CLIENT_ID, "client_secret": CLIENT_SECRET, "redirect_uri": REDIRECT,
                "grant_type": "authorization_code", "code": code, "code_verifier": record["verifier"],
            })
        response.raise_for_status()
        tokens = response.json()
        if not tokens.get("access_token") or SCOPE not in tokens.get("scope", "").split():
            raise ValueError("Required YouTube scope not granted")
        original = read_tokens(record["user"]) or {}
        if not tokens.get("refresh_token") and not original.get("refresh_token"):
            raise ValueError("Google did not return an offline refresh token")
        value = {
            "access_token": tokens["access_token"],
            "refresh_token": tokens.get("refresh_token") or original["refresh_token"],
            "expires_at": time.time() + int(tokens.get("expires_in", 3600)) - 60,
            "scope": tokens.get("scope", ""),
        }
        save_tokens(record["user"], value)
        result = "success"
    except (httpx.HTTPError, ValueError, KeyError):
        result = "failed"
    # Never leave the Google authorization code in a rendered page's URL.
    return RedirectResponse(url="/oauth/done?result=" + result, status_code=303,
                            headers={"Cache-Control": "no-store", "Referrer-Policy": "no-referrer"})


@app.get("/oauth/done")
async def done(result: str = "failed"):
    if result == "success":
        return done_page("Die Google-Verbindung wurde gespeichert.", True)
    return done_page("Bitte versuche die Anmeldung erneut. Kontrolliere Testnutzer, Google-Berechtigung und die Callback-Adresse.", False)


async def access_token(user_id: str) -> str:
    tokens = read_tokens(user_id)
    if not tokens:
        raise HTTPException(409, "Google account not connected")
    if tokens.get("expires_at", 0) > time.time() + 60:
        return tokens["access_token"]
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.post("https://oauth2.googleapis.com/token", data={
                "client_id": CLIENT_ID, "client_secret": CLIENT_SECRET,
                "refresh_token": tokens["refresh_token"], "grant_type": "refresh_token",
            })
        if resp.status_code != 200:
            raise HTTPException(409, "Google authorization expired. Connect again")
        value = resp.json()
        tokens["access_token"] = value["access_token"]
        tokens["expires_at"] = time.time() + int(value.get("expires_in", 3600)) - 60
        save_tokens(user_id, tokens)
        return tokens["access_token"]
    except (httpx.HTTPError, KeyError, ValueError) as exc:
        raise HTTPException(502, "Google token refresh unavailable") from exc


@app.get("/account")
async def account(x_velaris_jellyfin_token: str | None = Header(default=None)):
    uid = await authorized_user(x_velaris_jellyfin_token)
    return {"connected": read_tokens(uid) is not None}


@app.delete("/account")
async def disconnect(x_velaris_jellyfin_token: str | None = Header(default=None)):
    uid = await authorized_user(x_velaris_jellyfin_token)
    user_path(uid).unlink(missing_ok=True)
    CACHE.pop(uid, None)
    return {"connected": False}


async def yt(client: httpx.AsyncClient, token: str, path: str, params: dict) -> dict:
    try:
        r = await client.get("https://www.googleapis.com/youtube/v3/" + path,
                             headers={"Authorization": "Bearer " + token}, params=params)
        if r.status_code == 401:
            raise HTTPException(409, "Google authorization expired. Connect again")
        if r.status_code == 403:
            raise HTTPException(502, "YouTube API access denied or quota exceeded")
        r.raise_for_status()
        return r.json()
    except httpx.HTTPError as exc:
        raise HTTPException(502, "YouTube API not available") from exc


async def subscribed_channels(token: str) -> list[dict]:
    channels = []
    page = None
    async with httpx.AsyncClient(timeout=20) as client:
        for _ in range(10):  # 500 subscriptions maximum per refresh.
            params = {"part": "snippet", "mine": "true", "maxResults": 50}
            if page:
                params["pageToken"] = page
            data = await yt(client, token, "subscriptions", params)
            for item in data.get("items", []):
                snip = item.get("snippet") or {}
                channel = (snip.get("resourceId") or {}).get("channelId")
                if channel:
                    channels.append({
                        "id": channel, "title": snip.get("title", "YouTube"),
                        "thumbnail": ((snip.get("thumbnails") or {}).get("medium") or {}).get("url", ""),
                    })
            page = data.get("nextPageToken")
            if not page:
                break
    return channels


@app.get("/subscriptions")
async def subscriptions(x_velaris_jellyfin_token: str | None = Header(default=None)):
    uid = await authorized_user(x_velaris_jellyfin_token)
    saved = CACHE.get((uid, "subs"))
    if saved and time.time() - saved[0] < 1800:
        return {"channels": saved[1], "source": "cache"}
    token = await access_token(uid)
    channels = await subscribed_channels(token)
    CACHE[(uid, "subs")] = (time.time(), channels)
    return {"channels": channels, "source": "youtube"}


@app.get("/for-you")
async def for_you(x_velaris_jellyfin_token: str | None = Header(default=None)):
    uid = await authorized_user(x_velaris_jellyfin_token)
    saved = CACHE.get((uid, "feed"))
    if saved and time.time() - saved[0] < 1800:
        return {"videos": saved[1], "source": "cache"}
    subscriptions_data = await subscriptions(x_velaris_jellyfin_token)
    # Limit API quota and requests: first 30 channels, most recent 3 videos each.
    channels = subscriptions_data["channels"][:30]
    if not channels:
        return {"videos": [], "source": "youtube"}
    token = await access_token(uid)
    videos = []
    async with httpx.AsyncClient(timeout=25) as client:
        uploads = {}
        for i in range(0, len(channels), 50):
            data = await yt(client, token, "channels", {
                "part": "contentDetails", "id": ",".join(c["id"] for c in channels[i:i+50])
            })
            for channel in data.get("items", []):
                playlist = (((channel.get("contentDetails") or {}).get("relatedPlaylists") or {}).get("uploads"))
                if playlist:
                    uploads[channel["id"]] = playlist
        semaphore = asyncio.Semaphore(5)
        async def recent(channel):
            playlist = uploads.get(channel["id"])
            if not playlist:
                return []
            async with semaphore:
                data = await yt(client, token, "playlistItems", {
                    "part": "snippet,contentDetails", "playlistId": playlist, "maxResults": 3
                })
            items = []
            for item in data.get("items", []):
                snip = item.get("snippet") or {}
                video_id = ((item.get("contentDetails") or {}).get("videoId")
                            or (snip.get("resourceId") or {}).get("videoId"))
                title = snip.get("title", "")
                if not video_id or not re.fullmatch(r"[A-Za-z0-9_-]{11}", video_id) or title in ("Private video", "Deleted video"):
                    continue
                items.append({
                    "id": video_id, "title": title,
                    "channel": channel["title"], "channelId": channel["id"],
                    "thumbnail": ((snip.get("thumbnails") or {}).get("medium") or {}).get("url", ""),
                    "publishedAt": (item.get("contentDetails") or {}).get("videoPublishedAt") or snip.get("publishedAt", ""),
                })
            return items
        groups = await asyncio.gather(*(recent(c) for c in channels))
        for group in groups:
            videos.extend(group)
    videos.sort(key=lambda v: v["publishedAt"], reverse=True)
    videos = videos[:90]
    CACHE[(uid, "feed")] = (time.time(), videos)
    return {"videos": videos, "source": "youtube"}
