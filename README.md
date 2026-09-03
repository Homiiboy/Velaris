# Velaris

Velaris is a cinematic interface layer for Jellyfin Web with its own cyan, violet and magenta visual identity.

## Current release — V0.1.0

V0.1.0 introduces the **Velaris Unified App Shell**. The existing Home, Library, Search, Settings, Login, Details and Player layers now sit inside one shared interaction and navigation system instead of behaving like isolated theme patches.

### Highlights

- unified Velaris shell state across Jellyfin SPA routes
- expanded command bar with direct **Filme**, **Serien** and **Entdecken** navigation
- active navigation state and current-page status indicator
- cinematic page transitions between compatible Jellyfin views
- global Velaris treatment for compatible dialogs, menus, action sheets and notifications
- new reusable Velaris toast system for current and future feature modules
- consistent keyboard focus treatment across buttons, cards and list items
- shared ambient shell background that adapts to Player and authentication views
- modal / overlay state handling for Search, Settings and compatible Jellyfin dialogs
- new keyboard shortcuts `Alt + 1`, `Alt + 2` and `Alt + 3` for Home, Movies and Series
- respects the Full, Reduced and Off motion preferences introduced in V0.0.8
- retains Login & Profiles, Settings & Branding, Search, Library / Discover, Spotlight, Details and Player enhancements from previous releases

V0.1.0 deliberately does **not** replace Jellyfin's core router or playback internals. The shell enhances and coordinates the existing client so Velaris can become more independent without making playback unnecessarily fragile.

## Development & Release Strategy

Velaris remains in an active **feature-development phase through V1.0.0**.

Until V1.0.0, releases may introduce substantial new functionality, redesign existing areas, replace Jellyfin interface elements and expand Velaris into additional parts of the web client. The goal is to make Velaris a complete and coherent Jellyfin frontend experience rather than only a visual theme.

### Feature phase — V0.x.x through V1.0.0

During this phase the project may add or substantially rework:

- Home, Spotlight and discovery experiences
- Library, movie and series browsing
- Search and navigation
- Velaris settings and personalization
- login, profile and branding experiences
- series, seasons and episode interfaces
- collections, genres, actors and discovery pages
- player controls, playback overlays and Up Next experiences
- browser branding, favicon, page title, theme color and PWA presentation
- responsive desktop, tablet, mobile and TV-oriented layouts
- deeper Jellyfin Web integration where needed

Large UI and architecture changes are expected during the feature phase. Backward compatibility between development releases is therefore secondary to building the best final Velaris experience.

### Stabilization phase — after V1.0.0

Once V1.0.0 is reached, the primary feature set is considered complete. Development will then shift mainly toward bug fixes, Jellyfin-version compatibility, performance optimization, accessibility, responsive corrections, browser compatibility, visual polish, animation tuning, code cleanup and regression fixes.

Major new features should become the exception after V1.0.0.

## Releases & GitHub Packages

Starting with **V0.0.7**, Velaris uses an automated release pipeline.

Every versioned release provides:

- Git tag `vX.Y.Z`
- GitHub Release `Velaris vX.Y.Z`
- `velaris-vX.Y.Z.zip`
- `SHA256SUMS.txt`
- matching `@homiiboy/velaris` package in GitHub Packages
- release notes generated from `CHANGELOG.md`

The release ZIP and package include the active `dist/` modules, `assets/`, Tampermonkey loader, CSS loader, README, license and version metadata.

`package.json` and `VERSION` must contain the same version before publication. The automation lives in `.github/workflows/release.yml`.

Package:

```text
@homiiboy/velaris
```

Registry:

```text
https://npm.pkg.github.com
```

## Version archive

Historic releases live in `HistoricVersions/Vx.x.x/`.

Whenever a newer Velaris version is released, the previous version is frozen so it remains reproducible.

Current historic releases:

- `HistoricVersions/V0.0.3/`
- `HistoricVersions/V0.0.4/`
- `HistoricVersions/V0.0.5/`
- `HistoricVersions/V0.0.6/`
- `HistoricVersions/V0.0.7/`
- `HistoricVersions/V0.0.8/`
- `HistoricVersions/V0.0.9/`

## V0.1.0 bundle structure

The canonical `dist/velaris.css` and `dist/velaris.js` remain lightweight bundle loaders. V0.1.0 loads the frozen V0.0.9 release and adds:

- `dist/velaris-v010.css`
- `dist/velaris-v010.js`

The V0.1.0 feature code is pinned to commit `3b9895ae3ce86c5ee19ea74929b35eaf498a45aa`.

## Recommended installation — Tampermonkey

Install the userscript:

`https://raw.githubusercontent.com/Homiiboy/Velaris/main/velaris-loader.user.js`

The loader injects the pinned matching CSS and JavaScript bundle and includes Tampermonkey update metadata.

## Shortcuts

- `Ctrl + K` / `Cmd + K` — open Velaris Search
- `/` — open Velaris Search when another input is not active
- `↑` / `↓` — navigate visible search results
- `Enter` — open the focused result
- `Esc` — close Search or Settings
- `Ctrl + ,` / `Cmd + ,` — open Velaris Settings
- `Alt + 1` — Home
- `Alt + 2` — Movies / Filme
- `Alt + 3` — Series / Serien

## CSS-only installation

Paste into Jellyfin Custom CSS:

```css
@import url("https://cdn.jsdelivr.net/gh/Homiiboy/Velaris@3b9895ae3ce86c5ee19ea74929b35eaf498a45aa/dist/velaris.css");
```

CSS-only mode keeps the visual layers, but JavaScript-powered features such as Spotlight generation, dynamic library heroes, Search, Settings, browser branding, authentication detection, shell navigation and route coordination are reduced or unavailable.

## Manual JavaScript installation

```html
<script defer src="https://cdn.jsdelivr.net/gh/Homiiboy/Velaris@3b9895ae3ce86c5ee19ea74929b35eaf498a45aa/dist/velaris.js"></script>
```

## License

MIT
