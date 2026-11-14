# Velaris YouTube – V0.1.0 (development)

The existing scaffold has been moved onto a fresh branch based on Velaris 2.1.0.
This remains a **development service**, not an installed or tested Jellyfin plugin.

## Architecture

- `velaris-youtube-plugin/`: C# Jellyfin plugin registration/configuration only.
- `velaris-youtube-sidecar/`: FastAPI/yt-dlp service for resolving YouTube
  video metadata and temporary stream URLs, and archiving selected videos.
- Persistent archive: one directory per 11-character YouTube video ID, holding
  the downloaded media, thumbnail and `metadata.info.json`.

The sidecar **does not currently expose media inside Jellyfin**.
`GET /videos/{id}/stream` returns a **temporary direct source URL and its
required HTTP headers**, not a Jellyfin MediaSource or browser-safe streaming
proxy. URL expiry, codec negotiation and Jellyfin player integration are still
future milestones. Never log or display the raw stream URL publicly.

## Safe ZimaOS test deployment

1. Verify that the chosen host archive directory has adequate free disk space.
2. `cd services/velaris-youtube-sidecar`
3. `cp .env.example .env`
4. Generate a unique token with `openssl rand -hex 32`, then place it in
   `VELARIS_YOUTUBE_TOKEN` inside `.env`.
5. Set `VELARIS_YOUTUBE_ARCHIVE_PATH` to the absolute persistent directory.
6. `sudo docker compose up -d --build`
7. `curl http://127.0.0.1:8787/health`

The sidecar is bound **only to localhost**. Do not expose port 8787 to
the internet, a public reverse proxy, or untrusted applications.
When Jellyfin is later connected from a separate container, configure a
private Docker network and keep the bearer token secret.

## Protected API

All endpoints below require `Authorization: Bearer <token>`.

| Endpoint | Result |
| --- | --- |
| `GET /videos/{id}` | YouTube title, description, channel, thumbnail, duration |
| `GET /videos/{id}/stream` | Temporary direct playback URL + required headers |
| `POST /archive` (`{"video_id":"..."}`) | Queue a download; returns HTTP 202 |
| `GET /archive/{id}` | Queue state: queued/running/completed/failed/not_found |
| `GET /library` | List archived metadata and thumbnails |

Example (replace ID and token; use only a video you are permitted to archive):

```bash
curl -H "Authorization: Bearer $VELARIS_YOUTUBE_TOKEN" \
  "http://127.0.0.1:8787/videos/VIDEO_ID_HERE"
curl -X POST -H "Authorization: Bearer $VELARIS_YOUTUBE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"video_id":"VIDEO_ID_HERE"}' http://127.0.0.1:8787/archive
```

Archiving is **opt-in only**, one worker at a time. Jobs are kept in RAM;
after a service restart, completed files remain on disk while non-completed job
states are not retained. Media files must be scanned into Jellyfin later.
The service does not automatically subscribe to channels or download new videos.

Downloading and replaying content requires appropriate rights and compliance
with platform terms.

## Next phases

1. **0.1.x:** Confirm exact Jellyfin server version; build plugin against it;
   local ZimaOS smoke test and secret-handling checks.
2. **0.2.0:** Authenticated plugin-to-sidecar bridge; expiring stream resolver,
   proxy where needed, format compatibility and usable Jellyfin playback.
3. **0.3.0:** Jellyfin library scanner integration and polished cover art,
   description and metadata support for saved videos.
4. **0.4.0:** Channel/playlist browsing, synchronization options and robust
   download queue/state persistence.
5. **0.5.0:** Played status, permissions, error handling and integration tests.
6. **1.0.0:** UI and release testing for Velaris Web, iPhone PWA, TV and
   smartphone. YouTube category uses red `#FF0033` from shared brand config.

No third-party YouTubeSync or TubeArchivist source code is copied.
No GitHub Actions workflow should run automatically.
