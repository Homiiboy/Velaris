"""Velaris YouTube sidecar v0.1: metadata, streaming URL resolution, and archive queue.

Internal development API. Requires a strong bearer token and must stay
restricted to localhost or a private Docker network.
"""
import hmac
import json
import os
import re
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, Request as UpstreamRequest, build_opener
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from threading import Lock
from typing import Any

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from yt_dlp import YoutubeDL
from yt_dlp.utils import DownloadError

app = FastAPI(title="Velaris YouTube Sidecar", version="0.2.0")
VIDEO_ID = re.compile(r"^[A-Za-z0-9_-]{11}$")
ARCHIVE_DIR = Path(os.environ.get("ARCHIVE_DIR", "/downloads")).resolve()
API_TOKEN = os.environ.get("VELARIS_YOUTUBE_TOKEN", "")
# A single worker prevents a burst of downloads from exhausting a small NAS.
executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="velaris-yt")
tasks: dict[str, dict[str, Any]] = {}
task_lock = Lock()
stream_cache: dict[str, tuple[float, dict[str, Any]]] = {}
stream_lock = Lock()
RANGE_PATTERN = re.compile(r"^bytes=(?:[0-9]+-[0-9]*|-[1-9][0-9]*)$")


class NoRedirect(HTTPRedirectHandler):
    """Do not follow potentially untrusted redirects from a resolved media source."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


upstream_opener = build_opener(NoRedirect)



def authorize(authorization: str | None = Header(default=None)) -> None:
    if not API_TOKEN or not authorization or not hmac.compare_digest(
        authorization, f"Bearer {API_TOKEN}"
    ):
        raise HTTPException(status_code=401, detail="Unauthorized")


def video_url(video_id: str) -> str:
    if not VIDEO_ID.fullmatch(video_id):
        raise HTTPException(status_code=422, detail="Invalid YouTube video ID")
    return f"https://www.youtube.com/watch?v={video_id}"


def archived_info(video_id: str) -> dict[str, Any] | None:
    path = ARCHIVE_DIR / video_id / "metadata.info.json"
    if not path.is_file():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        if data.get("id") != video_id:
            return None
        return data
    except (OSError, ValueError):
        return None


class VideoRequest(BaseModel):
    video_id: str


def extract_metadata(video_id: str) -> dict[str, Any]:
    with YoutubeDL({"quiet": True, "no_warnings": True, "js_runtimes": {"node": {}}, "skip_download": True,
                    "noplaylist": True, "socket_timeout": 15}) as ydl:
        info = ydl.extract_info(video_url(video_id), download=False)
    if not info:
        raise DownloadError("No metadata returned")
    return info


@app.get("/health")
def health():
    return {"status": "ok", "service": "velaris-youtube-sidecar", "version": "0.2.0"}


@app.get("/videos/{video_id}", dependencies=[Depends(authorize)])
def metadata(video_id: str):
    try:
        info = extract_metadata(video_id)
    except DownloadError as exc:
        raise HTTPException(status_code=502, detail="YouTube metadata unavailable") from exc
    return {
        "id": info.get("id"), "title": info.get("title"),
        "description": info.get("description"), "thumbnail": info.get("thumbnail"),
        "duration": info.get("duration"), "channel": info.get("channel"),
        "uploader": info.get("uploader"), "upload_date": info.get("upload_date"),
        "archived": archived_info(video_id) is not None,
    }


@app.get("/videos/{video_id}/stream", dependencies=[Depends(authorize)])
def stream_source(video_id: str):
    """Resolve a short-lived source URL; not a Jellyfin playback endpoint yet."""
    try:
        with YoutubeDL({"quiet": True, "skip_download": True, "noplaylist": True,
                        "format": "best[ext=mp4]/best", "js_runtimes": {"node": {}}, "socket_timeout": 15}) as ydl:
            info = ydl.extract_info(video_url(video_id), download=False)
    except DownloadError as exc:
        raise HTTPException(status_code=502, detail="YouTube stream unavailable") from exc
    if not info or not info.get("url"):
        raise HTTPException(status_code=502, detail="No direct stream URL available")
    # This response is private. The URL expires and often requires headers.
    return {
        "id": video_id, "url": info["url"], "http_headers": info.get("http_headers", {}),
        "ext": info.get("ext"), "note": "Temporary source, not a Jellyfin MediaSource",
    }


def resolve_proxy_source(video_id: str, refresh: bool = False) -> dict[str, Any]:
    """Cache yt-dlp resolutions briefly, refresh on expiry or upstream denial."""
    video_url(video_id)  # Validate before cache lookup or external access.
    with stream_lock:
        cached = stream_cache.get(video_id)
        if not refresh and cached and cached[0] > time.monotonic():
            return cached[1]
    try:
        with YoutubeDL({
            "quiet": True, "no_warnings": True, "skip_download": True,
            "noplaylist": True, "format": "best[ext=mp4]/best",
            "js_runtimes": {"node": {}}, "socket_timeout": 15,
        }) as ydl:
            source = ydl.extract_info(video_url(video_id), download=False)
    except DownloadError as exc:
        raise HTTPException(status_code=502, detail="Video source resolution failed") from exc
    if not source or not isinstance(source.get("url"), str):
        raise HTTPException(status_code=502, detail="No direct video source")
    url = source["url"]
    parsed = urlsplit(url)
    host = (parsed.hostname or "").lower()
    # Prevent arbitrary URLs/SSRF: only HTTPS media URLs from Google's video CDN.
    if parsed.scheme != "https" or not (host == "googlevideo.com" or host.endswith(".googlevideo.com")):
        raise HTTPException(status_code=502, detail="Unsupported media source host")
    source_headers = source.get("http_headers") or {}
    if not isinstance(source_headers, dict):
        source_headers = {}
    allowed_headers = {
        str(k): str(v) for k, v in source_headers.items()
        if str(k).lower() in ("user-agent", "referer", "origin", "accept", "accept-language")
    }
    result = {"url": url, "headers": allowed_headers}
    with stream_lock:
        stream_cache[video_id] = (time.monotonic() + 90, result)
    return result


def open_proxy_source(video_id: str, byte_range: str | None):
    """Open upstream before sending downstream headers so errors remain HTTP errors."""
    for attempt in range(2):
        source = resolve_proxy_source(video_id, refresh=(attempt == 1))
        headers = dict(source["headers"])
        if byte_range:
            headers["Range"] = byte_range
        try:
            response = upstream_opener.open(UpstreamRequest(source["url"], headers=headers), timeout=30)
            if response.status not in (200, 206):
                response.close()
                raise HTTPException(status_code=502, detail="Unexpected upstream response")
            return response
        except HTTPError as exc:
            exc.close()
            if attempt == 0 and exc.code in (401, 403, 410):
                continue  # Expired signed URL; refresh once.
            if exc.code == 416:
                raise HTTPException(status_code=416, detail="Range not satisfiable") from exc
            raise HTTPException(status_code=502, detail="Upstream media unavailable") from exc
        except (URLError, OSError, TimeoutError) as exc:
            raise HTTPException(status_code=502, detail="Media connection failed") from exc
    raise HTTPException(status_code=502, detail="Media source expired")


@app.get("/videos/{video_id}/proxy", dependencies=[Depends(authorize)])
def proxy_video(video_id: str, request: Request):
    """Private streaming proxy with HTTP Range support for a future Jellyfin bridge.

    The API bearer token is required. Do not expose this endpoint through an
    unauthenticated browser or copy the token into Velaris client-side code.
    """
    video_url(video_id)
    byte_range = request.headers.get("range")
    if byte_range and not RANGE_PATTERN.fullmatch(byte_range):
        raise HTTPException(status_code=416, detail="Unsupported Range request")
    response = open_proxy_source(video_id, byte_range)
    content_type = response.headers.get("Content-Type", "video/mp4").split(";")[0]
    if content_type not in ("video/mp4", "application/octet-stream"):
        response.close()
        raise HTTPException(status_code=502, detail="Unsupported upstream content type")
    # Prime the stream to detect failures before sending response headers.
    try:
        first = response.read(64 * 1024)
    except (OSError, TimeoutError) as exc:
        response.close()
        raise HTTPException(status_code=502, detail="Media read failed") from exc
    if not first:
        response.close()
        raise HTTPException(status_code=502, detail="Upstream returned empty media")

    out_headers = {
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
    }
    for key in ("Content-Length", "Content-Range"):
        value = response.headers.get(key)
        if value:
            out_headers[key] = value

    def chunks():
        try:
            yield first
            while True:
                chunk = response.read(64 * 1024)
                if not chunk:
                    break
                yield chunk
        finally:
            response.close()

    return StreamingResponse(
        chunks(),
        status_code=response.status,
        media_type=content_type,
        headers=out_headers,
    )


def archive_video(video_id: str) -> None:
    dest = ARCHIVE_DIR / video_id
    try:
        dest.mkdir(parents=True, exist_ok=True)
        with YoutubeDL({
            "quiet": True, "noplaylist": True, "restrictfilenames": True,
            "js_runtimes": {"node": {}},
            "paths": {"home": str(dest)},
            "outtmpl": {"default": "video.%(ext)s", "thumbnail": "poster.%(ext)s"},
            "format": "bv*+ba/b", "merge_output_format": "mp4",
            "writethumbnail": True, "writeinfojson": True, "socket_timeout": 20,
        }) as ydl:
            info = ydl.extract_info(video_url(video_id), download=True)
        if not info or info.get("id") != video_id:
            raise RuntimeError("Video identity mismatch")
        # Stable metadata name independent of the downloaded video extension.
        (dest / "metadata.info.json").write_text(
            json.dumps({
                "id": video_id, "title": info.get("title"),
                "description": info.get("description"), "thumbnail": info.get("thumbnail"),
                "channel": info.get("channel"), "duration": info.get("duration"),
                "upload_date": info.get("upload_date"),
            }, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        with task_lock:
            tasks[video_id] = {"id": video_id, "status": "completed"}
    except Exception:
        with task_lock:
            tasks[video_id] = {"id": video_id, "status": "failed",
                               "detail": "Download failed; check server logs"}
        raise


@app.post("/archive", status_code=202, dependencies=[Depends(authorize)])
def archive(request: VideoRequest):
    video_id = request.video_id
    video_url(video_id)
    if archived_info(video_id):
        return {"id": video_id, "status": "already_archived"}
    with task_lock:
        current = tasks.get(video_id)
        if current and current["status"] in ("queued", "running"):
            return current
        tasks[video_id] = {"id": video_id, "status": "queued"}
    def task():
        with task_lock:
            tasks[video_id] = {"id": video_id, "status": "running"}
        archive_video(video_id)
    executor.submit(task)
    return {"id": video_id, "status": "queued"}


@app.get("/archive/{video_id}", dependencies=[Depends(authorize)])
def archive_status(video_id: str):
    video_url(video_id)
    if archived_info(video_id):
        return {"id": video_id, "status": "completed"}
    with task_lock:
        task = tasks.get(video_id)
        return task or {"id": video_id, "status": "not_found"}


@app.get("/library", dependencies=[Depends(authorize)])
def library():
    if not ARCHIVE_DIR.is_dir():
        return {"items": []}
    results = []
    for folder in ARCHIVE_DIR.iterdir():
        if folder.is_dir() and VIDEO_ID.fullmatch(folder.name):
            info = archived_info(folder.name)
            if info:
                results.append(info)
    return {"items": sorted(results, key=lambda item: item.get("title") or "")}
