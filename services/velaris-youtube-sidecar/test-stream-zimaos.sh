#!/usr/bin/env bash
# YouTube v0.2 preflight: resolve an actual source and probe a small byte range.
# Do not display or persist the temporary signed URL or bearer token.
# Usage: bash services/velaris-youtube-sidecar/test-stream-zimaos.sh [VIDEO_ID]
set -euo pipefail
VIDEO_ID="${1:-jNQXAC9IVRw}"
if [[ ! "$VIDEO_ID" =~ ^[A-Za-z0-9_-]{11}$ ]]; then
  echo "Please supply a valid 11-character YouTube video ID." >&2
  exit 2
fi

if ! sudo docker container inspect velaris-youtube-sidecar >/dev/null 2>&1; then
  echo "Sidecar not found. Run setup-zimaos.sh first." >&2
  exit 1
fi

# Run within the sidecar so the test uses its exact network and runtime.
# The API token is read from the existing container environment, never printed.
sudo docker exec -i velaris-youtube-sidecar python - "$VIDEO_ID" <<'PY'
import json
import os
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

video_id = sys.argv[1]
token = os.environ.get("VELARIS_YOUTUBE_TOKEN", "")
if not token or token == "replace-with-a-random-secret":
    print("FAIL: API token is missing from the container")
    sys.exit(1)

print("1/2 Resolving a real YouTube stream through the protected API ...")
req = Request(
    "http://127.0.0.1:8787/videos/" + video_id + "/stream",
    headers={"Authorization": "Bearer " + token},
)
try:
    with urlopen(req, timeout=90) as response:
        data = json.load(response)
except (HTTPError, URLError, OSError, ValueError):
    print("FAIL: stream resolver could not return a playable source (see sidecar logs)")
    sys.exit(1)

source = data.get("url")
if not isinstance(source, str) or urlsplit(source).scheme != "https":
    print("FAIL: resolver did not return an HTTPS media source")
    sys.exit(1)

headers = data.get("http_headers") or {}
if not isinstance(headers, dict):
    headers = {}
# Only the source's request headers and Range are sent; no sidecar bearer token.
headers = {str(k): str(v) for k, v in headers.items()
           if str(k).lower() not in ("authorization", "cookie", "range", "host")}
headers["Range"] = "bytes=0-1023"
print("PASS: temporary media source resolved (URL intentionally hidden)")
print("2/2 Checking whether the sidecar can read the beginning of the stream ...")
try:
    with urlopen(Request(source, headers=headers), timeout=25) as response:
        status = response.status
        content_type = response.headers.get("Content-Type", "unknown").split(";")[0]
        # A server ignoring Range could begin a full response; read at most 1024 bytes.
        sample = response.read(1024)
except (HTTPError, URLError, OSError, ValueError):
    print("FAIL: source is not readable from this Docker container")
    print("Possible causes: YouTube blocking, an expired URL, or missing source headers")
    sys.exit(1)

if status not in (200, 206) or not sample:
    print("FAIL: source returned no media bytes")
    sys.exit(1)
if not (content_type.startswith("video/") or content_type.startswith("audio/")
        or content_type == "application/octet-stream"):
    print("WARN: unexpected content type: " + content_type)
print(f"PASS: source reachable (HTTP {status}; type {content_type}; sampled {len(sample)} bytes)")
print("Streaming preflight passed; Jellyfin player integration is NOT yet tested.")
PY
