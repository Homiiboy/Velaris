"""Development sidecar: metadata and manually requested archival only.

Not exposed publicly; access is restricted by a bearer token. Streaming,
Jellyfin library synchronization and background jobs are future milestones.
"""
import os
import re
from pathlib import Path

from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel
from yt_dlp import YoutubeDL

app = FastAPI(title="Velaris YouTube Sidecar", version="0.1.0")
VIDEO_ID = re.compile(r"^[A-Za-z0-9_-]{11}$")
ARCHIVE_DIR = Path(os.environ.get("ARCHIVE_DIR", "/downloads"))
API_TOKEN = os.environ.get("VELARIS_YOUTUBE_TOKEN", "")


def authorize(authorization: str | None = Header(default=None)) -> None:
    import hmac
    if not API_TOKEN or not authorization or not hmac.compare_digest(authorization, f"Bearer {API_TOKEN}"):
        raise HTTPException(status_code=401, detail="Unauthorized")


class VideoRequest(BaseModel):
    video_id: str


def video_url(video_id: str) -> str:
    if not VIDEO_ID.fullmatch(video_id):
        raise HTTPException(status_code=422, detail="Invalid YouTube video ID")
    return f"https://www.youtube.com/watch?v={video_id}"


@app.get("/health")
def health():
    return {"status": "ok", "service": "velaris-youtube-sidecar"}


@app.get("/videos/{video_id}", dependencies=[Depends(authorize)])
def metadata(video_id: str):
    url = video_url(video_id)
    with YoutubeDL({"quiet": True, "skip_download": True, "noplaylist": True}) as ydl:
        info = ydl.extract_info(url, download=False)
    return {
        "id": info.get("id"),
        "title": info.get("title"),
        "description": info.get("description"),
        "thumbnail": info.get("thumbnail"),
        "duration": info.get("duration"),
        "channel": info.get("channel"),
    }


@app.post("/archive", dependencies=[Depends(authorize)])
def archive(request: VideoRequest):
    url = video_url(request.video_id)
    ARCHIVE_DIR.mkdir(parents=True, exist_ok=True)
    # Restricted to a verified video ID and fixed archive directory.
    with YoutubeDL({
        "quiet": True,
        "noplaylist": True,
        "paths": {"home": str(ARCHIVE_DIR)},
        "outtmpl": "%(id)s/%(title).150B [%(id)s].%(ext)s",
        "format": "bv*+ba/b",
        "merge_output_format": "mp4",
        "writethumbnail": True,
        "writeinfojson": True,
        "restrictfilenames": True,
    }) as ydl:
        info = ydl.extract_info(url, download=True)
    return {"id": info.get("id"), "title": info.get("title"), "archived": True}
