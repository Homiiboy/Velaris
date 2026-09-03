# Velaris

Velaris is a cinematic interface layer for Jellyfin Web with its own cyan, violet and magenta visual identity.

## Current release — V0.0.8

V0.0.8 introduces the first dedicated **Velaris Settings & Branding** layer. Velaris can now be configured directly inside Jellyfin and keeps those preferences locally in the current browser.

### Highlights

- dedicated Velaris Settings drawer integrated into the command bar
- persistent settings via `localStorage`
- Spotlight on/off control
- animation modes: Full, Reduced and Off
- UI density modes: Compact, Standard and Spacious
- configurable card sizing: Small, Medium and Large
- accent intensity modes: Subtle, Balanced and Vivid
- optional Velaris browser-tab title
- custom Velaris SVG favicon replacing Jellyfin's browser icon
- optional Velaris browser / PWA theme color
- `Ctrl + ,` / `Cmd + ,` shortcut for Settings
- responsive Settings UI for desktop and mobile
- retains Velaris Search, Library / Discover, Spotlight, cinematic details and player enhancements from earlier releases

The browser branding icon is stored in `assets/velaris-mark.svg` and is included in GitHub Releases and GitHub Packages.

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

## V0.0.8 bundle structure

The canonical `dist/velaris.css` and `dist/velaris.js` remain lightweight bundle loaders. V0.0.8 loads the frozen V0.0.7 bundle and adds:

- `dist/velaris-v008.css`
- `dist/velaris-v008.js`

The V0.0.8 feature code is pinned to commit `f9155bbf6826fff434e1c827f087622ec667911c`.

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

## CSS-only installation

Paste into Jellyfin Custom CSS:

```css
@import url("https://cdn.jsdelivr.net/gh/Homiiboy/Velaris@f9155bbf6826fff434e1c827f087622ec667911c/dist/velaris.css");
```

CSS-only mode keeps the visual layers, but JavaScript-powered features such as Spotlight generation, dynamic library heroes, Velaris Search, Settings, browser branding, row reordering and page detection are reduced or unavailable.

## Manual JavaScript installation

```html
<script defer src="https://cdn.jsdelivr.net/gh/Homiiboy/Velaris@f9155bbf6826fff434e1c827f087622ec667911c/dist/velaris.js"></script>
```

## License

MIT
