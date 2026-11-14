#!/usr/bin/env bash
# Velaris YouTube V0.2 proxy smoke test: authorization and bounded HTTP ranges.
# Usage: bash services/velaris-youtube-sidecar/test-proxy-zimaos.sh [VIDEO_ID]
set -euo pipefail
VIDEO_ID="${1:-jNQXAC9IVRw}"
if [[ ! "$VIDEO_ID" =~ ^[A-Za-z0-9_-]{11}$ ]]; then
  echo "Invalid video ID: use 11 letters/numbers/_/-." >&2
  exit 2
fi
sudo docker exec -i velaris-youtube-sidecar python - "$VIDEO_ID" <<'PY'
import os
import sys
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

video_id = sys.argv[1]
token = os.environ.get("VELARIS_YOUTUBE_TOKEN")
if not token or token == "replace-with-a-random-secret":
    print("FAIL: sidecar token not configured")
    sys.exit(1)
url = "http://127.0.0.1:8787/videos/" + video_id + "/proxy"

print("1/3 Unauthorized playback should return HTTP 401 ...")
try:
    urlopen(Request(url, headers={"Range": "bytes=0-1023"}), timeout=10)
except HTTPError as exc:
    if exc.code != 401:
        print(f"FAIL: expected 401, got HTTP {exc.code}")
        sys.exit(1)
else:
    print("FAIL: unprotected playback")
    sys.exit(1)
print("PASS: HTTP 401")

print("2/3 Invalid Range should return HTTP 416 ...")
try:
    urlopen(Request(url, headers={
        "Authorization": "Bearer " + token,
        "Range": "bytes=0-1023,2048-4095",
    }), timeout=10)
except HTTPError as exc:
    if exc.code != 416:
        print(f"FAIL: expected 416, got HTTP {exc.code}")
        sys.exit(1)
else:
    print("FAIL: unsupported multipart Range accepted")
    sys.exit(1)
print("PASS: HTTP 416")

print("3/3 Streaming first 1024 bytes using HTTP Range ...")
try:
    with urlopen(Request(url, headers={
        "Authorization": "Bearer " + token,
        "Range": "bytes=0-1023",
    }), timeout=120) as response:
        status = response.status
        content_type = response.headers.get("Content-Type", "").split(";")[0]
        content_range = response.headers.get("Content-Range", "")
        body = response.read(1024)
except (HTTPError, URLError, OSError) as exc:
    print("FAIL: proxy could not deliver video data; inspect sanitized server logs")
    print("Status: " + (str(exc.code) if isinstance(exc, HTTPError) else "connection error"))
    sys.exit(1)
if status != 206 or not content_range.startswith("bytes 0-1023/"):
    print(f"FAIL: expected HTTP 206 and Content-Range bytes 0-1023/*; got HTTP {status}")
    sys.exit(1)
if len(body) != 1024 or content_type != "video/mp4":
    print(f"FAIL: expected 1024 video/mp4 bytes, got {len(body)} bytes, type {content_type}")
    sys.exit(1)
print("PASS: HTTP 206, Content-Range valid, 1024 video/mp4 bytes")
print("PASS: Streaming proxy preflight succeeded")
print("NOTE: Jellyfin player integration and browser playback are still pending")
PY
