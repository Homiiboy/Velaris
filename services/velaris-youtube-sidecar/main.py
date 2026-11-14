"""Velaris YouTube sidecar v0.1: metadata, streaming URL resolution, and archive queue.

Internal development API. Requires a strong bearer token and must stay
restricted to localhost or a private Docker network.
"""
import hmac
import json
import os
import re
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from threading import Lock
from typing import Any

from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel
from yt_dlp import YoutubeDL
from yt_dlp.utils import DownloadError

app = FastAPI(title="Velaris YouTube Sidecar", version="0.1.0")
VIDEO_ID = re.compile(r"^[A-Za-z0-9_-]{11}$")
ARCHIVE_DIR = Path(os.environ.get("ARCHIVE_DIR", "/downloads")).resolve()
API_TOKEN = os.environ.get("VELARIS_YOUTUBE_TOKEN", "")
# A single worker prevents a burst of downloads from exhausting a small NAS.
executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="velaris-yt")
tasks: dict[str, dict[str, Any]] = {}
task_lock = Lock()


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
    with YoutubeDL({"quiet": True, "no_warnings": True, "skip_download": True,
                    "noplaylist": True, "socket_timeout": 15}) as ydl:
        info = ydl.extract_info(video_url(video_id), download=False)
    if not info:
        raise DownloadError("No metadata returned")
    return info


@app.get("/health")
def health():
    return {"status": "ok", "service": "velaris-youtube-sidecar", "version": "0.1.0"}


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
                        "format": "best[ext=mp4]/best", "socket_timeout": 15}) as ydl:
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


def archive_video(video_id: str) -> None:
    dest = ARCHIVE_DIR / video_id
    try:
        dest.mkdir(parents=True, exist_ok=True)
        with YoutubeDL({
            "quiet": True, "noplaylist": True, "restrictfilenames": True,
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
