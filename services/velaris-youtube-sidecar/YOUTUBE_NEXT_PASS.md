# Velaris YouTube – priorities (15 November 2026)

## Blocker – resolve before feature pass 2

**Longer YouTube videos fail to load while the 19-second test video
`jNQXAC9IVRw` plays correctly.** Reproduce on a real failing video,
inspect selected source format, audio/video compatibility, Range headers
and duration/timeout behavior; implement support for longer adaptive
YouTube streams where needed. Do **not** regard a 1024-byte 206 response
as end-to-end playback success. Preserve the working short video path.

## Requested YouTube UI & Features Pass 2 (in this order)

1. Include **all** subscribed channels, not just the first 30.
2. Improve For You ranking/diversity across subscriptions.
3. Show video duration and published date on cards.
4. Sort and search subscriptions by channel name.
5. Record watch history per Velaris profile.
6. Add YouTube search inside Velaris.
7. Optimize fullscreen player on desktop and iPhone.

User explicitly requested that these seven items be remembered and
deferred until longer-video playback is fixed.
