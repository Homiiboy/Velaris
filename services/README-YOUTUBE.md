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

## Safe ZimaOS deployment from `main`

Jellyfin on the target server: **10.11.11**. The plugin is not yet
built or installed. Deploy **only** the standalone sidecar first.

Run on the ZimaOS host (no second Git clone needed):

```bash
cd ~/AppData/Velaris-v2
git pull origin main
bash services/velaris-youtube-sidecar/setup-zimaos.sh
```

The setup script:
- Generates a **random 64-character API token** from `/dev/urandom` (using `od`) in a private
  `.env` (only on first setup; updates preserve it).
- Creates `services/velaris-youtube-sidecar/data` with Docker uid/gid
  **10001** only if it does not already exist. Existing archive ownership
  is never changed automatically.
- Uses Docker Compose to build and start `velaris-youtube-sidecar`.
- Publishes **only** `127.0.0.1:8787`, not a LAN/public port.

Do not commit or share the private `.env` file. Keep your usual
`~/AppData/Velaris-v2` checkout; updates remain `git pull origin main`.
If the host has another process on 8787, stop and resolve the conflict
before changing port mappings.

After the service starts:

```bash
cd ~/AppData/Velaris-v2
bash services/velaris-youtube-sidecar/test-zimaos.sh
sudo docker compose -f services/velaris-youtube-sidecar/compose.yaml ps
```

Expected smoke-test results: health JSON with `status: ok`, anonymous
`/library` returns HTTP 401, authorized `/library` returns a JSON array,
and an invalid video ID returns HTTP 422.

To check metadata for a real publicly accessible video, use only its
**11-character video ID** as the optional first argument:

```bash
bash services/velaris-youtube-sidecar/test-zimaos.sh VIDEO_ID_HERE
```

This contacts YouTube and may fail owing to network restrictions,
rate limiting or extractor changes. **No video is downloaded** by the
smoke test.

For troubleshooting:

```bash
cd ~/AppData/Velaris-v2/services/velaris-youtube-sidecar
sudo docker compose ps
sudo docker compose logs --tail=60
```

The service remains isolated from the existing web app on 8089, the
legacy web instance on 8088 and Jellyfin on 8097. Do not expose port
8787 to a public reverse proxy or place the bearer token in browser code.
A later Jellyfin plugin integration will require a separate private
container network and proper authentication.

## Streaming preflight (V0.2.0, before Jellyfin integration)

The live metadata test already passed on ZimaOS for `jNQXAC9IVRw`.
Next, check that the sidecar can resolve a **real source** and read a small
byte range from it. No video is downloaded or saved; **temporary signed
media URLs and API tokens are never printed**.

```bash
cd ~/AppData/Velaris-v2
git pull origin main
bash services/velaris-youtube-sidecar/test-stream-zimaos.sh jNQXAC9IVRw
```

The streaming test invokes the existing protected
`GET /videos/{id}/stream` API within Docker, then requests at most
1024 bytes from its HTTPS media source. It requires no new port and no
rebuild because this step adds only a host-side test script.

**Successful preflight** means: the resolver provides a temporary source and
the sidecar can access bytes from it. It does **not** mean the Jellyfin 10.11.11
player can already use that source, or that all formats/codecs work. If a
source is unavailable due to YouTube restrictions, the test exits with a
sanitized error; troubleshoot the resolver with:

```bash
cd ~/AppData/Velaris-v2/services/velaris-youtube-sidecar
sudo docker compose logs --tail=60
```

Do not share logs if they contain any credentials or signed source URLs.

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

1. **0.1.x:** Jellyfin server version confirmed: **10.11.11** (.NET 9); build plugin against it;
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
