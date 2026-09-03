# Velaris

Velaris is a cinematic interface layer for Jellyfin Web with its own cyan, violet and magenta visual identity.

## Current release — V0.2.0

V0.2.0 introduces the dedicated **Velaris Series Experience**. Series detail pages now receive an API-driven Series Hub with a focused Next Up experience, season navigation and a custom episode guide while the V0.1.0 Unified App Shell remains the frozen foundation.

### Highlights

- API-driven **Velaris Series Hub** for compatible Jellyfin series detail pages
- dedicated **Als Nächstes / Next Up** hero using Jellyfin's next-up data when available
- direct season navigation with dedicated **Specials** handling
- season cards with episode counts and watched progress when Jellyfin exposes user data
- responsive landscape episode cards with artwork, episode number, runtime, premiere date and overview
- watched and partially-watched episode states
- per-episode progress bars and `Gesehen` status treatment
- automatic selection of the season containing the current Next Up episode when possible
- per-season episode caching to reduce repeated Jellyfin API calls while browsing seasons
- dedicated empty, loading and error states
- safe fallback to Jellyfin's native episode surfaces when the Velaris episode layer reports an API error
- responsive desktop, tablet and mobile layouts
- respects the existing Full, Reduced and Off Velaris motion modes
- exposes `window.VelarisSeries` for refresh, season selection and current Series Hub state
- retains the V0.1.0 App Shell, Login & Profiles, Settings & Branding, Search, Library / Discover, Spotlight, Details and Player enhancements

V0.2.0 uses Jellyfin's own client API for series, seasons, episodes and Next Up data. It does not replace Jellyfin's playback engine or authentication internals.

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
- `HistoricVersions/V0.1.0/`

## V0.2.0 bundle structure

The canonical `dist/velaris.css` and `dist/velaris.js` remain lightweight bundle loaders. V0.2.0 loads the frozen V0.1.0 release and adds:

- `dist/velaris-v020.css`
- `dist/velaris-v020.js`

The V0.2.0 feature bundle is pinned to commit `35e35d3f3406e99e91d1a4d4c31493eb4c9fb1c3`.

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
@import url("https://cdn.jsdelivr.net/gh/Homiiboy/Velaris@35e35d3f3406e99e91d1a4d4c31493eb4c9fb1c3/dist/velaris.css");
```

CSS-only mode keeps the visual layers, but JavaScript-powered features such as the API-driven Series Hub, Spotlight generation, dynamic library heroes, Search, Settings, browser branding, authentication detection, shell navigation and route coordination are reduced or unavailable.

## Manual JavaScript installation

```html
<script defer src="https://cdn.jsdelivr.net/gh/Homiiboy/Velaris@35e35d3f3406e99e91d1a4d4c31493eb4c9fb1c3/dist/velaris.js"></script>
```

## License

MIT
