# Changelog

## 0.1.0 — 2026-09-03

- Added the **Velaris Unified App Shell** milestone.
- Added shell-wide SPA route detection and shared page state across Home, Library, Details, Player, Auth and browse views.
- Expanded the Velaris command bar with direct Movies, Series and Discover navigation.
- Added active navigation states and a compact current-page status indicator.
- Added cinematic route transitions that respect the existing Velaris motion preference.
- Added consistent Velaris treatment for compatible Jellyfin dialogs, menus, action sheets and notifications.
- Added a reusable `VelarisShell.toast()` notification surface for current and future modules.
- Added shared focus-visible styling for keyboard navigation across buttons, cards and list items.
- Added a persistent ambient shell background with Player and authentication adaptations.
- Added global modal / overlay state coordination for Search, Settings and compatible Jellyfin surfaces.
- Added `Alt + 1`, `Alt + 2` and `Alt + 3` shortcuts for Home, Movies and Series.
- Added modular `dist/velaris-v010.css` and `dist/velaris-v010.js` feature layers.
- Converted the canonical bundle loaders to use the frozen V0.0.9 release as their base.
- Archived V0.0.9 under `HistoricVersions/V0.0.9/`.

## 0.0.9 — 2026-09-03

- Added the dedicated **Velaris Login & Profiles** feature layer.
- Added a cinematic Velaris authentication shell for compatible Jellyfin login views.
- Redesigned username, password and sign-in controls with a responsive glass-panel layout.
- Added a dedicated profile-selection experience with a `Wer schaut heute?` presentation.
- Added responsive profile cards with larger avatar treatment and improved focus / hover states.
- Added a local `Zuletzt` marker for the last selected profile name without storing credentials.
- Added styling for compatible Jellyfin server-selection and connection views.
- Integrated compatible native secondary actions such as manual login, password recovery, server connection and Back.
- Added SPA-aware login/profile/server detection for Jellyfin DOM changes.
- Added support for the V0.0.8 motion preferences on authentication views.
- Added modular `dist/velaris-v009.css` and `dist/velaris-v009.js` feature layers.
- Converted the canonical bundle loaders to use the frozen V0.0.8 release as their base.
- Archived V0.0.8 under `HistoricVersions/V0.0.8/`.

## 0.0.8 — 2026-09-03

- Added the dedicated **Velaris Settings & Branding** feature layer.
- Added an in-app Settings drawer integrated into the Velaris command bar.
- Added persistent browser-local settings via `localStorage`.
- Added Spotlight visibility control.
- Added Full, Reduced and Off animation modes.
- Added Compact, Standard and Spacious UI-density modes.
- Added Small, Medium and Large card-size modes.
- Added Subtle, Balanced and Vivid accent-intensity modes.
- Added optional Velaris browser-tab title handling.
- Added a custom SVG Velaris favicon and optional browser theme color.
- Added `Ctrl/Cmd + ,` as a global Settings shortcut.
- Added responsive desktop and mobile Settings layouts.
- Added `assets/velaris-mark.svg` and included assets in release ZIPs and GitHub Packages.
- Added modular `dist/velaris-v008.css` and `dist/velaris-v008.js` feature layers.
- Converted the canonical bundle loaders to use the frozen V0.0.7 release as their base.
- Archived V0.0.7 under `HistoricVersions/V0.0.7/`.

## 0.0.7 — 2026-09-03

- Added the dedicated **Velaris Search & Navigation** feature layer.
- Added a full-screen live library search overlay powered by Jellyfin's client API.
- Added grouped Movie, Series and Episode search results with category filters.
- Added poster artwork, media type, year and episode metadata to search results.
- Added keyboard navigation for search results plus `Ctrl/Cmd + K`, `/` and Escape shortcuts.
- Added a new Velaris command bar with Home, Search and current-page context.
- Redirected compatible native Jellyfin header search controls into Velaris Search.
- Added responsive desktop, tablet and mobile search layouts.
- Added separate timers for search debounce and SPA refresh handling.
- Added modular `dist/velaris-v007.css` and `dist/velaris-v007.js` feature layers.
- Converted the canonical bundle loaders to use the frozen V0.0.6 release as their base.
- Archived V0.0.6 under `HistoricVersions/V0.0.6/`.

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
- Added smart row classification for English/German Jellyfin labels.
- Prioritized Continue Watching and Next Up rows below the hero.
- Added custom horizontal rail controls.
- Added responsive and reduced-motion handling.
