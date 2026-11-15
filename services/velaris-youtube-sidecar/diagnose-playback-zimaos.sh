#!/usr/bin/env bash
# Diagnose a specific YouTube video without exposing Jellyfin/sidecar tokens.
# Usage: bash services/velaris-youtube-sidecar/diagnose-playback-zimaos.sh VIDEO_ID
set -euo pipefail
VIDEO_ID="${1:-}"
if [[ ! "$VIDEO_ID" =~ ^[A-Za-z0-9_-]{11}$ ]]; then
  echo "Usage: bash services/velaris-youtube-sidecar/diagnose-playback-zimaos.sh VIDEO_ID" >&2
  exit 2
fi
HERE="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
if [ ! -f "$HERE/.env" ]; then
  echo "FAIL: sidecar .env not found" >&2
  exit 1
fi
# Read env from a private file without echoing its value.
export DIAG_VIDEO_ID="$VIDEO_ID"
export DIAG_ENV_FILE="$HERE/.env"
python3 - <<'PY'
import json
import os
import re
import urllib.error
import urllib.request
from urllib.parse import urlsplit
from pathlib import Path

video_id=os.environ["DIAG_VIDEO_ID"]
secret_path=Path(os.environ["DIAG_ENV_FILE"])
secret=None
for line in secret_path.read_text().splitlines():
    if line.startswith("VELARIS_YOUTUBE_TOKEN="):
        secret=line.split("=",1)[1].strip().strip('"').strip("'")
if not secret:
    raise SystemExit("FAIL: sidecar token missing")
base="http://127.0.0.1:8787/videos/"+video_id
headers={"Authorization":"Bearer "+secret}
def call(suffix, range_header=None):
    req_headers=dict(headers)
    if range_header:
        req_headers["Range"]=range_header
    req=urllib.request.Request(base+suffix,headers=req_headers)
    try:
        with urllib.request.urlopen(req,timeout=80) as response:
            status=response.status
            typ=response.headers.get("Content-Type","").split(";")[0]
            length=response.headers.get("Content-Length","?")
            cr=response.headers.get("Content-Range","")
            # Limit reads to a few bytes and close; never download whole media.
            first=response.read(64) if suffix=="/proxy" else response.read(200000)
            data=json.loads(first) if suffix=="/stream" else {}
            return {"status":status,"type":typ,"length":length,"range":cr,"data":data}
    except urllib.error.HTTPError as exc:
        return {"status":exc.code,"type":"error","length":"-","range":"","data":{}}
    except (urllib.error.URLError, TimeoutError) as exc:
        return {"status":"network/timeout","type":"error","length":"-","range":"","data":{}}

print("Video-ID:",video_id)
print("Prüfe Stream-Auflösung …")
source=call("/stream")
print("Stream-API Status:",source["status"])
if source["status"]==200:
    data=source["data"]
    print("Container:",data.get("ext","?"))
    # Never print signed URLs or source headers.
    print("Direkt-URL verfügbar:",bool(data.get("url")))
    signed=data.get("url")
    if signed:
        host=(urlsplit(signed).hostname or "").lower()
        if urlsplit(signed).scheme!="https" or not (host=="googlevideo.com" or host.endswith(".googlevideo.com")):
            print("CDN-Test: Übersprungen (Quelle außerhalb der erlaubten Google-Video-Domain)")
        else:
            # Use the same safelisted source headers as the sidecar. Do not
            # print credentials, response bodies or signed media URLs.
            safe_headers={str(k):str(v) for k,v in (data.get("http_headers") or {}).items()
                          if str(k).lower() in ("user-agent","referer","origin","accept","accept-language")}
            safe_headers["Range"]="bytes=0-1023"
            try:
                with urllib.request.urlopen(urllib.request.Request(signed,headers=safe_headers),timeout=30) as direct:
                    print("CDN HTTP-Status:",direct.status)
                    print("CDN Content-Type:",direct.headers.get("Content-Type","unbekannt").split(";")[0])
                    print("CDN Accept-Ranges:",direct.headers.get("Accept-Ranges","nicht angegeben"))
                    direct.read(64)
            except urllib.error.HTTPError as exc:
                print("CDN HTTP-Status:",exc.code)
                exc.close()
            except (urllib.error.URLError,TimeoutError,OSError):
                print("CDN-Status: Netzwerkfehler/Timeout")
print("Prüfe erste 1024 Bytes (HTTP Range) …")
r=call("/proxy","bytes=0-1023")
print("Proxy Status:",r["status"])
print("Content-Type:",r["type"])
print("Content-Length:",r["length"])
print("Content-Range vorhanden:",bool(r["range"]))
print("Hinweis: Ein HTTP-206-Test garantiert noch keine lauffähige vollständige MP4-Datei.")
PY
