"""Velaris local Chromecast bridge. Runs on ZimaOS host network for mDNS discovery.

All commands require a valid Jellyfin token; commands operate only on devices
discovered by the bridge. Do not expose this service to the public internet.
"""
import json
import logging
import os
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode
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
_LAST_SCAN = 0.0
_ACTIVE = {}  # Device uuid -> Jellyfin user ID. Never persist credentials.
_MAX_BODY = 4096


def jellyfin_get(path, token):
    req = Request(JELLYFIN_LOCAL + path, headers={"X-Emby-Token": token, "Accept": "application/json"})
    with urlopen(req, timeout=8) as response:
        return json.load(response)


def discover(force=False):
    global _LAST_SCAN
    with _LOCK:
        if not force and time.monotonic() - _LAST_SCAN < 20:
            return [dict(id=k, name=cast.name, model=cast.cast_info.model_name or "")
                    for k, cast in _DEVICES.items()]
        _LAST_SCAN = time.monotonic()
    casts, browser = pychromecast.get_chromecasts(timeout=4, tries=1, known_hosts=KNOWN_HOSTS or None)
    try:
        fresh = {str(cast.uuid): cast for cast in casts if cast.uuid}
    finally:
        pychromecast.discovery.stop_discovery(browser)
    with _LOCK:
        _DEVICES.update(fresh)
        return [dict(id=k, name=cast.name, model=cast.cast_info.model_name or "")
                for k, cast in _DEVICES.items()]


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
                cast.wait(timeout=12)
                # Chromecast itself retrieves this URL from the LAN. The Jellyfin token
                # is needed by the receiver; it never appears in bridge responses/logs.
                params = urlencode({"api_key": token, "VideoCodec": "h264", "AudioCodec": "aac",
                                    "TranscodingContainer": "ts"})
                url = JELLYFIN_CAST + "/Videos/" + quote(item_id) + "/master.m3u8?" + params
                cast.media_controller.play_media(url, "application/x-mpegURL", title=item.get("Name", "Velaris"),
                                                 stream_type="BUFFERED")
                with _LOCK:
                    _ACTIVE[device_id] = user_id
                return self.answer(200, {"ok": True, "device": cast.name})
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
