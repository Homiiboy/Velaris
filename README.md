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

## Development & Release Strategy

Velaris remains in an active **feature-development phase through V1.0.0**.

Until V1.0.0, releases may introduce substantial new functionality, redesign existing areas, replace Jellyfin interface elements and expand Velaris into additional parts of the web client. The goal of this phase is to make Velaris a complete and coherent Jellyfin frontend experience rather than only a visual theme.

### Feature phase — V0.x.x through V1.0.0

During this phase the project may add or substantially rework features such as:

- Home, Spotlight and discovery experiences
- Library, movie and series browsing
- Search and navigation
- Velaris settings and personalization
- login, profile and branding experiences
- series, seasons and episode interfaces
- collections, genres, actors and discovery pages
- player controls, playback overlays and Up Next experiences
- browser branding such as favicon, page title, theme color and PWA presentation
- responsive desktop, tablet, mobile and TV-oriented layouts
- deeper Jellyfin Web integration where needed

Large UI and architecture changes are expected during the feature phase. Backward compatibility between development releases is therefore secondary to building the best final Velaris experience.

### Stabilization phase — after V1.0.0

Once V1.0.0 is reached, the primary feature set is considered complete. Development will then shift mainly toward:

- bug fixes
- Jellyfin-version compatibility
- performance optimization
- accessibility improvements
- responsive-layout corrections
- browser compatibility
- visual consistency and polish
- animation and interaction tuning
- code cleanup and maintainability
- reliability and regression fixes

Major new features should become the exception after V1.0.0 so that the project can focus on stability and refinement.

## Releases & GitHub Packages

Starting with **V0.0.7**, Velaris uses a complete automated release pipeline.

Every versioned release is intended to provide:

- a Git tag in the form `vX.Y.Z`
- a GitHub Release named `Velaris vX.Y.Z`
- a ready-to-use `velaris-vX.Y.Z.zip` release asset
- a `SHA256SUMS.txt` checksum file for release verification
- the matching `@homiiboy/velaris` package in GitHub Packages
- release notes generated from the matching section in `CHANGELOG.md`

The package manifest is stored in `package.json`. `package.json` and `VERSION` must always contain the same version number before a release is published.

The automation lives in `.github/workflows/release.yml`. When a new version is prepared on `main`, the workflow validates the version, packages the current distribution files, creates the GitHub Release if it does not already exist and publishes the matching GitHub Package if that version is not already available.

Package name:

```text
@homiiboy/velaris
```

Package registry:

```text
https://npm.pkg.github.com
```

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
