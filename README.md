# Velaris

Velaris is a cinematic interface layer for Jellyfin Web with its own cyan, violet and magenta visual identity.

## Current release — V0.0.7

V0.0.7 adds a dedicated **Velaris Search & Navigation** layer on top of the V0.0.6 home, library, detail and player experience.

### Highlights

- new full-screen **Velaris Search** overlay
- live Jellyfin library search for movies, series and episodes
- grouped results for Movies, Series and Episodes
- category chips for quickly filtering the current result set
- poster artwork, type labels, year and episode metadata in search results
- keyboard-first navigation with arrow keys and Enter
- global **Ctrl/Cmd + K** shortcut to open Velaris Search
- `/` shortcut to open search when no input field is active
- Escape closes the overlay
- new Velaris command bar in the Jellyfin header with Home, Search and current-page context
- compatible native Jellyfin search buttons are redirected into Velaris Search
- dedicated desktop, tablet and mobile search layouts
- separate search debounce and Jellyfin SPA-refresh timers for more reliable live results
- retains the V0.0.6 Library / Discover redesign, Spotlight, cinematic details and player treatment

## Version archive

Historic releases live in `HistoricVersions/Vx.x.x/`.

Whenever a newer Velaris version is released, the previous version is frozen and moved into `HistoricVersions` so it remains reproducible and accessible.

Current historic releases:

- `HistoricVersions/V0.0.3/`
- `HistoricVersions/V0.0.4/`
- `HistoricVersions/V0.0.5/`
- `HistoricVersions/V0.0.6/`

## V0.0.7 bundle structure

The canonical `dist/velaris.css` and `dist/velaris.js` stay lightweight. V0.0.7 loads the frozen V0.0.6 bundle and then adds:

- `dist/velaris-v007.css`
- `dist/velaris-v007.js`

The V0.0.7 feature code is pinned to commit `3c4159f2b47a1a8392aa0abdafbf11cf8bb07eaa`.

## Recommended installation — Tampermonkey

Velaris includes a ready-to-use userscript loader:

`velaris-loader.user.js`

Install URL:

`https://raw.githubusercontent.com/Homiiboy/Velaris/main/velaris-loader.user.js`

With Tampermonkey installed, open the URL above and confirm the userscript installation. The loader automatically injects the pinned V0.0.7 bundle and includes update metadata for future Velaris releases.

## Search shortcuts

- `Ctrl + K` / `Cmd + K` — open Velaris Search
- `/` — open Velaris Search when you are not typing in another field
- `↑` / `↓` — move through visible search results
- `Enter` — open the focused result
- `Esc` — close Velaris Search

## CSS-only installation

If JavaScript is not wanted, paste this into **Jellyfin → Dashboard → General → Custom CSS**:

```css
@import url("https://cdn.jsdelivr.net/gh/Homiiboy/Velaris@3c4159f2b47a1a8392aa0abdafbf11cf8bb07eaa/dist/velaris.css");
```

CSS-only mode keeps the visual layers, but JavaScript-powered features such as Spotlight generation, dynamic library heroes, Velaris Search, row reordering and page detection are reduced or unavailable.

## Manual JavaScript installation

If Tampermonkey is not used, load the matching JavaScript with another custom-script injection method:

```html
<script defer src="https://cdn.jsdelivr.net/gh/Homiiboy/Velaris@3c4159f2b47a1a8392aa0abdafbf11cf8bb07eaa/dist/velaris.js"></script>
```

## License

MIT
