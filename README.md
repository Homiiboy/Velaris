# Velaris

Velaris is a cinematic interface layer for Jellyfin Web with its own cyan, violet and magenta visual identity.

## Current release — V0.0.6

V0.0.6 expands Velaris into Jellyfin's library, movie, series and browse views. The release keeps the stable V0.0.5 home/detail/player layer and adds a dedicated modular Library / Discover enhancement on top.

### Highlights

- new **Velaris Collection** hero on compatible library and browse pages
- hero artwork assembled dynamically from visible Jellyfin library cards
- contextual titles and descriptions for movies, series, favorites, collections and genres
- visible title-count badge in the Collection hero
- redesigned filter, sort and view controls with a glass toolbar treatment
- responsive library grid with dedicated desktop, tablet and mobile layouts
- refined library-card hover states and captions
- redesigned alphabet picker, paging and empty-state presentation
- library-aware SPA refresh handling for dynamic Jellyfin page changes
- retains the rotating **Velaris Spotlight**, cinematic detail pages and redesigned player OSD from V0.0.5
- V0.0.6 introduces a modular bundle structure so future feature layers can be added without rewriting the entire base bundle

## Version archive

Historic releases live in `HistoricVersions/Vx.x.x/`.

Whenever a newer Velaris version is released, the previous version is frozen and moved into `HistoricVersions` so it remains reproducible and accessible.

Current historic releases:

- `HistoricVersions/V0.0.3/`
- `HistoricVersions/V0.0.4/`
- `HistoricVersions/V0.0.5/`

## V0.0.6 bundle structure

The current `dist/velaris.css` and `dist/velaris.js` are lightweight bundle loaders. They load the frozen V0.0.5 base and then the V0.0.6 modules:

- `dist/velaris-v006.css`
- `dist/velaris-v006.js`

This keeps historic behavior stable while making future Velaris development easier to maintain.

## Recommended installation — Tampermonkey

Velaris includes a ready-to-use userscript loader:

`velaris-loader.user.js`

Install URL:

`https://raw.githubusercontent.com/Homiiboy/Velaris/main/velaris-loader.user.js`

With Tampermonkey installed, open the URL above and confirm the userscript installation. The loader automatically injects the pinned V0.0.6 bundle.

The loader includes Tampermonkey update metadata so newer Velaris versions can be detected automatically.

## CSS-only installation

If JavaScript is not wanted, paste this into **Jellyfin → Dashboard → General → Custom CSS**:

```css
@import url("https://cdn.jsdelivr.net/gh/Homiiboy/Velaris@d7dbe4117f766aa3209c7a45f3ea51daceb31915/dist/velaris.css");
```

CSS-only mode keeps the visual layer, but JavaScript-powered features such as Spotlight generation, dynamic library heroes, row reordering and page detection are reduced or unavailable.

## Manual JavaScript installation

If Tampermonkey is not used, load the matching JavaScript with another custom-script injection method:

```html
<script defer src="https://cdn.jsdelivr.net/gh/Homiiboy/Velaris@d7dbe4117f766aa3209c7a45f3ea51daceb31915/dist/velaris.js"></script>
```

## License

MIT
