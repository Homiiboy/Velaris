# Changelog

## 0.0.6 — 2026-09-03

- Added a dedicated Velaris Library / Discover redesign for movie, series and browse views.
- Added the dynamic **Velaris Collection** hero using visible Jellyfin library artwork.
- Added contextual library titles, descriptions and visible title counts.
- Added glass-style filter, sort and view controls.
- Added a responsive library grid with dedicated desktop, tablet and mobile behavior.
- Added refined library card hover states, captions, alphabet picker, paging and empty-state styling.
- Added library-specific SPA refresh handling for dynamic Jellyfin page changes.
- Introduced modular `dist/velaris-v006.css` and `dist/velaris-v006.js` feature layers.
- Converted the canonical `dist/velaris.css` and `dist/velaris.js` files into lightweight V0.0.6 bundle loaders that retain the frozen V0.0.5 base.
- Archived V0.0.5 under `HistoricVersions/V0.0.5/`.

## 0.0.5 — 2026-09-02

- Added a dedicated cinematic redesign for Jellyfin detail pages.
- Added the `Velaris Cinema` detail-page marker.
- Added stronger backdrop grading, oversized title styling, metadata pills and glass action buttons.
- Added a redesigned player OSD with glass controls and Velaris playback badge.
- Added Velaris accent styling for player progress controls and player buttons.
- Improved Spotlight stability after Jellyfin SPA rerenders by re-resolving disconnected cards.
- Added Spotlight image preloading.
- Spotlight now pauses on hover/focus and when outside the viewport.
- Added keyboard left/right Spotlight navigation.
- Added resize-aware refresh handling.
- Archived V0.0.4 under `HistoricVersions/V0.0.4/`.

## 0.0.4 — 2026-09-02

- Reworked Spotlight into a rotating featured hero with multiple titles.
- Added Spotlight dots and previous/next controls.
- Added smart Favorites row detection.
- Improved horizontal rail controls with actual scroll-state awareness.
- Enlarged Continue Watching and Next Up cards on desktop.
- Expanded Jellyfin SPA page detection for home, browse, details, player and login views.
- Strengthened Velaris header/navigation styling.
- Added pinned historic V0.0.3 loader.

## 0.0.3 — 2026-09-02

- Migrated the interface to the new Velaris identity.
- Added the first JavaScript enhancement layer.
- Added a generated cinematic Spotlight hero.
- Added smart row classification for English and German Jellyfin labels.
- Prioritized Continue Watching and Next Up rows below the hero.
- Added custom horizontal rail controls.
- Added responsive and reduced-motion handling.
