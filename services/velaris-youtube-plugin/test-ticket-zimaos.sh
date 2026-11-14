#!/usr/bin/env bash
# Tests authenticated playback ticket issuance and byte range delivery.
# Never prints API tokens, tickets, or signed YouTube media URLs.
set -euo pipefail

if [ -z "${JF_TOKEN:-}" ]; then
  read -rsp "Jellyfin API-Schlüssel: " JF_TOKEN
  printf '\n'
fi
if [ -z "$JF_TOKEN" ]; then
  echo "FAIL: no Jellyfin token supplied." >&2
  exit 1
fi

JF_TOKEN="$JF_TOKEN" python3 - <<'PY'
import json
import os
import re
import sys
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

base = "http://127.0.0.1:8097"
token = os.environ["JF_TOKEN"]
auth = 'MediaBrowser Client="Velaris", Device="ZimaOS", DeviceId="velaris-youtube-ticket-test", Version="0.2.1", Token="' + token + '"'
endpoint = base + "/VelarisYouTube/Videos/jNQXAC9IVRw/Ticket"

print("1/3 Ticket issuing without login must return HTTP 401 ...")
try:
    with urlopen(Request(endpoint, method="POST", data=b""), timeout=10):
        pass
except HTTPError as exc:
    if exc.code != 401:
        sys.exit("FAIL: unauthenticated endpoint returned HTTP " + str(exc.code))
else:
    sys.exit("FAIL: ticket endpoint accessible without login")
print("PASS: HTTP 401")

print("2/3 Create ticket with Jellyfin authentication ...")
try:
    with urlopen(Request(endpoint, method="POST", data=b"", headers={"Authorization": auth}), timeout=60) as response:
        data = json.load(response)
except HTTPError as exc:
    sys.exit("FAIL: ticket request returned HTTP " + str(exc.code))
except (URLError, OSError, ValueError):
    sys.exit("FAIL: Jellyfin could not issue a ticket")

path = data.get("playbackPath", "")
if not re.fullmatch(r"/VelarisYouTube/Playback/[A-F0-9]{64}", path):
    sys.exit("FAIL: no valid playback ticket returned")
print("PASS: Jellyfin created a private video-scoped ticket (hidden)")

print("3/3 Streaming an HTTP Range through the ticket URL ...")
try:
    with urlopen(Request(base + path, headers={"Range": "bytes=0-1023"}), timeout=120) as response:
        status = response.status
        ctype = response.headers.get("Content-Type", "").split(";")[0]
        content_range = response.headers.get("Content-Range", "")
        media = response.read(1024)
except HTTPError as exc:
    sys.exit("FAIL: ticket stream returned HTTP " + str(exc.code))
except (URLError, OSError):
    sys.exit("FAIL: ticket stream network/read error")

if status != 206 or ctype != "video/mp4" or len(media) != 1024 or not content_range.startswith("bytes 0-1023/"):
    sys.exit("FAIL: expected HTTP 206, video/mp4, Content-Range and 1024 bytes")
print("PASS: HTTP 206 / video/mp4 / 1024 bytes")
print("PASS: Ticketed YouTube streaming reached Jellyfin successfully")
PY
