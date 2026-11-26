"""Velaris local Chromecast bridge. Runs on ZimaOS host network for mDNS discovery.

All commands require a valid Jellyfin token; commands operate only on devices
discovered by the bridge. Do not expose this service to the public internet.
"""
import atexit
import json
import logging
import os
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode, urljoin, urlsplit, urlunsplit, parse_qsl
from urllib.request import Request, urlopen

import pychromecast

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
LOG = logging.getLogger("velaris.cast")
BIND = os.getenv("CAST_BRIDGE_BIND", "0.0.0.0")
PORT = int(os.getenv("CAST_BRIDGE_PORT", "8766"))
JELLYFIN_LOCAL = os.getenv("JELLYFIN_LOCAL_URL", "http://127.0.0.1:8097").rstrip("/")
JELLYFIN_CAST = os.getenv("JELLYFIN_CAST_URL", "http://192.168.0.74:8097").rstrip("/")
KNOWN_HOSTS = [host.strip() for host in os.getenv("CAST_KNOWN_HOSTS", "").split(",") if host.strip()]
_LOCK = threading.RLock()
_DEVICES = {}
_DISCOVERY_LOCK = threading.Lock()
_DISCOVERY_BROWSER = None  # Keep Zeroconf alive while Chromecast sockets need mDNS.
_DISCOVERY_READY = threading.Event()
_ACTIVE = {}  # Device uuid -> Jellyfin user ID. Never persist credentials.
_MAX_BODY = 4096


def jellyfin_get(path, token):
    req = Request(JELLYFIN_LOCAL + path, headers={"X-Emby-Token": token, "Accept": "application/json"})
    with urlopen(req, timeout=8) as response:
        return json.load(response)



# Chromecast receivers cannot use the PWA's authenticated Jellyfin session.
# Negotiate a receiver-compatible source using the same Jellyfin PlaybackInfo
# endpoint the working local player uses, then rewrite it to the LAN origin.
_CAST_PROFILE = {
    "Name": "Velaris Chromecast (H.264/AAC)",
    "MaxStreamingBitrate": 12_000_000,
    "MaxStaticBitrate": 12_000_000,
    "DirectPlayProfiles": [
        {"Type": "Video", "Container": "mp4,m4v,mov",
         "VideoCodec": "h264", "AudioCodec": "aac,mp3"}
    ],
    "TranscodingProfiles": [
        {"Type": "Video", "Context": "Streaming", "Protocol": "hls",
         "Container": "ts", "VideoCodec": "h264", "AudioCodec": "aac",
         "Conditions": []}
    ],
    "SubtitleProfiles": [],
    "CodecProfiles": [],
    "ContainerProfiles": [],
}


def jellyfin_playback_info(item_id, user_id, token):
    body = json.dumps({
        "UserId": user_id,
        "IsPlayback": True,
        "AutoOpenLiveStream": True,
        "EnableDirectPlay": True,
        "EnableDirectStream": True,
        "EnableTranscoding": True,
        "MaxStreamingBitrate": 12_000_000,
        "DeviceProfile": _CAST_PROFILE,
    }).encode("utf-8")
    req = Request(
        JELLYFIN_LOCAL + "/Items/" + quote(item_id) + "/PlaybackInfo",
        data=body,
        headers={
            "X-Emby-Token": token, "Accept": "application/json",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urlopen(req, timeout=12) as response:
        return json.load(response)


def cast_media_source(item_id, token, playback):
    """Return LAN URL and receiver MIME; never return an unplayable source path."""
    sources = playback.get("MediaSources") or []
    if not sources:
        raise RuntimeError("Jellyfin hat keine abspielbare Medienquelle zurückgegeben.")
    source = sources[0]
    source_id = source.get("Id") or ""
    session_id = playback.get("PlaySessionId") or ""
    container = str(source.get("Container") or "").lower()
    codecs = {str(track.get("Type") or "").lower():
              str(track.get("Codec") or "").lower()
              for track in (source.get("MediaStreams") or [])
              if track.get("Type") in ("Video", "Audio")}
    can_direct = (
        source.get("SupportsDirectPlay") is not False
        and container in ("mp4", "m4v", "mov")
        and codecs.get("video") == "h264"
        and codecs.get("audio") in ("aac", "mp3")
    )
    if can_direct:
        params = {"Static": "true", "api_key": token}
        if source_id:
            params["MediaSourceId"] = source_id
        url = JELLYFIN_CAST + "/Videos/" + quote(item_id) + "/stream.mp4?" + urlencode(params)
        return url, "video/mp4", "Direct Play"

    transcoding = source.get("TranscodingUrl") or ""
    if transcoding:
        # A negotiated path is trusted only if it belongs to our Jellyfin
        # server. Never send credentials to an external playback endpoint.
        parts = urlsplit(urljoin(JELLYFIN_LOCAL + "/", transcoding))
        allowed = {urlsplit(JELLYFIN_LOCAL).netloc, urlsplit(JELLYFIN_CAST).netloc}
        if parts.netloc not in allowed or parts.scheme not in ("http", "https"):
            raise RuntimeError("Jellyfin lieferte eine unerwartete Streaming-Adresse.")
        params = dict(parse_qsl(parts.query, keep_blank_values=True))
        if not any(k.lower() == "api_key" or k.lower() == "apikey" for k in params):
            params["api_key"] = token
        path = parts.path
        url = JELLYFIN_CAST + path + "?" + urlencode(params)
        if path.lower().endswith(".m3u8"):
            return url, "application/vnd.apple.mpegurl", "HLS Transcoding"
        if path.lower().endswith(".mp4"):
            return url, "video/mp4", "MP4 Transcoding"
        raise RuntimeError("Jellyfin lieferte ein unbekanntes Streamingformat.")

    if source.get("SupportsTranscoding") is False:
        raise RuntimeError(
            "Der Film ist auf Chromecast nicht direkt abspielbar und "
            "Jellyfin erlaubt für diese Medienquelle kein Transcoding."
        )
    params = {
        "api_key": token, "VideoCodec": "h264", "AudioCodec": "aac",
        "TranscodingContainer": "ts", "MaxStreamingBitrate": "12000000",
    }
    if source_id:
        params["MediaSourceId"] = source_id
    if session_id:
        params["PlaySessionId"] = session_id
    url = JELLYFIN_CAST + "/Videos/" + quote(item_id) + "/master.m3u8?" + urlencode(params)
    return url, "application/vnd.apple.mpegurl", "HLS Transcoding (fallback)"

def check_cast_jellyfin_url():
    """The Chromecast must reach this LAN endpoint independently of the iPhone/Tailscale."""
    url = JELLYFIN_CAST + "/System/Info/Public"
    try:
        with urlopen(Request(url, headers={"Accept": "application/json"}), timeout=5) as response:
            if response.status != 200:
                raise RuntimeError("Der Jellyfin-Server antwortet unter der Chromecast-Adresse nicht korrekt.")
            data = json.load(response)
            if not isinstance(data, dict) or not (data.get("ServerName") or data.get("Version")):
                raise RuntimeError("Die Chromecast-Adresse liefert keine gültigen Jellyfin-Serverdaten.")
    except (HTTPError, URLError, OSError, ValueError) as exc:
        LOG.warning("Cast Jellyfin LAN endpoint unavailable: %s", type(exc).__name__)
        raise RuntimeError(
            "Jellyfin ist über die für Chromecast eingestellte LAN-Adresse nicht erreichbar ("
            + JELLYFIN_CAST + "). Bitte JELLYFIN_CAST_URL in apps/web/.env prüfen."
        ) from exc


def _remember_cast(cast):
    """Receive devices asynchronously while keeping the live browser available."""
    if cast.uuid is None:
        return
    with _LOCK:
        _DEVICES[str(cast.uuid)] = cast
    _DISCOVERY_READY.set()


def _device_list():
    with _LOCK:
        return [
            dict(id=k, name=cast.name, model=cast.cast_info.model_name or "")
            for k, cast in _DEVICES.items()
        ]


def discover(force=False):
    """Start mDNS once and keep the browser alive for subsequent /play calls.

    Stopping a CastBrowser immediately after listing devices shuts down its
    Zeroconf event loop, which is still required by Chromecast.socket_client.
    For additional devices, the long-lived browser delivers new callbacks.
    """
    global _DISCOVERY_BROWSER
    if _DISCOVERY_BROWSER is None:
        with _DISCOVERY_LOCK:
            if _DISCOVERY_BROWSER is None:
                _DISCOVERY_READY.clear()
                # Non-blocking discovery callback updates the shared device map
                # after the initial request as well.
                _DISCOVERY_BROWSER = pychromecast.get_chromecasts(
                    blocking=False, callback=_remember_cast,
                    tries=1, timeout=8, known_hosts=KNOWN_HOSTS or None
                )
                LOG.info("Chromecast discovery started; mDNS kept alive for playback")
    if not _DISCOVERY_READY.is_set():
        _DISCOVERY_READY.wait(timeout=4)
    return _device_list()


def stop_discovery():
    """Close sockets before shutting down the shared Zeroconf event loop."""
    global _DISCOVERY_BROWSER
    with _DISCOVERY_LOCK:
        browser = _DISCOVERY_BROWSER
        _DISCOVERY_BROWSER = None
        with _LOCK:
            casts = list(_DEVICES.values())
            _DEVICES.clear()
            _ACTIVE.clear()
        for cast in casts:
            try:
                if cast.socket_client.is_alive():
                    cast.disconnect(timeout=2)
            except Exception:
                LOG.debug("Cast socket cleanup failed", exc_info=True)
        if browser is not None:
            browser.stop_discovery()


atexit.register(stop_discovery)


def device_for(device_id, user_id, allow_new=False):
    with _LOCK:
        cast = _DEVICES.get(device_id)
        owner = _ACTIVE.get(device_id)
    if cast is None:
        raise ValueError("Chromecast nicht gefunden. Bitte Geräte erneut suchen.")
    if owner is not None and owner != user_id:
        raise PermissionError("Dieses Gerät wird von einem anderen Profil verwendet.")
    if owner is None and not allow_new:
        raise ValueError("Für dieses Profil läuft keine Cast-Sitzung.")
    return cast


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        LOG.info("%s %s", self.client_address[0], fmt % args)

    def answer(self, status, data):
        raw = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def input(self):
        size = int(self.headers.get("Content-Length", "0"))
        if size > _MAX_BODY or size < 0:
            raise ValueError("Ungültige Anfragegröße.")
        return json.loads(self.rfile.read(size)) if size else {}

    def handle_request(self, method):
        if self.path not in ("/devices", "/status", "/play", "/control"):
            return self.answer(404, {"error": "Nicht gefunden."})
        token = self.headers.get("X-Velaris-Jellyfin-Token", "")
        if not token or len(token) > 512:
            return self.answer(401, {"error": "Jellyfin-Anmeldung erforderlich."})
        try:
            user = jellyfin_get("/Users/Me", token)
            user_id = user.get("Id")
            if not user_id:
                return self.answer(401, {"error": "Ungültiges Jellyfin-Profil."})
        except (HTTPError, URLError, OSError, ValueError):
            return self.answer(401, {"error": "Jellyfin-Anmeldung konnte nicht geprüft werden."})
        try:
            if method == "GET" and self.path == "/devices":
                return self.answer(200, {"devices": discover(force=True)})
            if method == "GET" and self.path == "/status":
                with _LOCK:
                    ids = [device_id for device_id, owner in _ACTIVE.items() if owner == user_id]
                results = []
                for device_id in ids:
                    cast = device_for(device_id, user_id)
                    status = cast.media_controller.status
                    results.append({"deviceId": device_id, "name": cast.name,
                                    "state": status.player_state or "UNKNOWN",
                                    "idleReason": getattr(status, "idle_reason", None),
                                    "position": status.current_time or 0,
                                    "duration": status.duration or 0})
                return self.answer(200, {"sessions": results})
            if method != "POST":
                return self.answer(405, {"error": "Methode nicht erlaubt."})
            data = self.input()
            device_id = str(data.get("deviceId", ""))
            if self.path == "/play":
                cast = device_for(device_id, user_id, allow_new=True)
                item_id = str(data.get("itemId", ""))
                if len(item_id) != 32 or not all(c in "0123456789abcdefABCDEF" for c in item_id):
                    raise ValueError("Ungültige Jellyfin-Medien-ID.")
                item = jellyfin_get("/Users/" + quote(user_id) + "/Items/" + quote(item_id), token)
                if item.get("Type") not in ("Movie", "Episode"):
                    raise ValueError("Nur Filme und Episoden können abgespielt werden.")
                check_cast_jellyfin_url()
                cast.wait(timeout=12)
                # Select a playable receiver source before sending LOAD. The TV
                # fetches it over LAN; the PWA's Tailscale URL is not usable there.
                playback = jellyfin_playback_info(item_id, user_id, token)
                url, mime, mode = cast_media_source(item_id, token, playback)
                LOG.info("Cast media request device=%s mode=%s mime=%s", cast.name, mode, mime)
                cast.media_controller.play_media(url, mime, title=item.get("Name", "Velaris"),
                                                 stream_type="BUFFERED")
                with _LOCK:
                    _ACTIVE[device_id] = user_id
                return self.answer(200, {"ok": True, "device": cast.name, "state": "STARTING",
                                         "mode": mode})
            if self.path == "/control":
                cast = device_for(device_id, user_id)
                action = data.get("action")
                if action == "pause":
                    cast.media_controller.pause()
                elif action == "resume":
                    cast.media_controller.play()
                elif action == "stop":
                    cast.media_controller.stop()
                    with _LOCK:
                        _ACTIVE.pop(device_id, None)
                elif action == "seek":
                    position = float(data.get("position", 0))
                    if not 0 <= position <= 86400:
                        raise ValueError("Ungültige Position.")
                    cast.media_controller.seek(position)
                else:
                    raise ValueError("Unbekannter Wiedergabebefehl.")
                return self.answer(200, {"ok": True})
            return self.answer(404, {"error": "Nicht gefunden."})
        except RuntimeError as exc:
            return self.answer(502, {"error": str(exc)})
        except (ValueError, TypeError) as exc:
            return self.answer(400, {"error": str(exc)})
        except PermissionError as exc:
            return self.answer(403, {"error": str(exc)})
        except Exception as exc:
            LOG.warning("Cast operation failed: %s", type(exc).__name__)
            return self.answer(502, {"error": "Chromecast nicht erreichbar oder Wiedergabe abgelehnt."})

    def do_GET(self):
        self.handle_request("GET")

    def do_POST(self):
        self.handle_request("POST")


if __name__ == "__main__":
    LOG.info("Velaris Cast Bridge listening on port %s", PORT)
    ThreadingHTTPServer((BIND, PORT), Handler).serve_forever()
