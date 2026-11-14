# Velaris YouTube – development scaffold (v0.1.0)

This directory adds a **Jellyfin plugin project** and a **separate yt-dlp sidecar**.
It does **not yet provide playback inside Jellyfin/Velaris**, browse channels or
automatically synchronize library entries. Do not install this as a finished plugin.

## Directories
- `velaris-youtube-plugin/`: C#/.NET 9 Jellyfin plugin entry point and config.
- `velaris-youtube-sidecar/`: restricted Python API for YouTube video metadata and manually requested archival.

## Jellyfin version
The project defaults to Jellyfin SDK 10.11.11. Match the exact running Jellyfin
server version by changing the MSBuild property:
`dotnet build services/velaris-youtube-plugin/Velaris.YouTube.csproj -p:JellyfinVersion=10.11.11`
Jellyfin 12 requires a separate .NET 10/12.x build target.

## Local development
1. `cd services/velaris-youtube-sidecar`
2. `cp .env.example .env`, replace token using `openssl rand -hex 32`.
3. Set an appropriate persistent `VELARIS_YOUTUBE_ARCHIVE_PATH`.
4. `docker compose up -d --build`.
5. `curl http://127.0.0.1:8787/health`.
6. Metadata API: `GET /videos/{video_id}`; archival: `POST /archive` with JSON `{"video_id":"..."}`. Both require `Authorization: Bearer <token>`.

The sidecar binds only to localhost on the Docker host. Inside a Docker
container, `127.0.0.1` refers to that container, **not another container**.
When integrating Jellyfin, use a shared private Docker network and service name,
do not expose the API publicly, and handle the token as a secret.

Downloaded files, metadata JSON and thumbnails are written under the configured
archive path. Mount that directory as a Jellyfin media library later. Archival
requires permission to download the selected content and compliance with
applicable service terms.

## Next milestones
1. Confirm ZimaOS Jellyfin exact version; build matching plugin.
2. Add authenticated Jellyfin plugin-to-sidecar client and library provider.
3. Add playable stream resolver/proxy with format compatibility and URL expiry.
4. Add async archival queue, artwork/metadata import, deduplication by video ID.
5. Add controls in Velaris Web, TV and Mobile, plus integration tests.

No third-party YouTubeSync or TubeArchivist source code is copied here.
