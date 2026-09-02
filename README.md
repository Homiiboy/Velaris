# Velaris

Velaris is a cinematic interface layer for Jellyfin Web with its own cyan, violet and magenta visual identity.

## Current version: V0.0.4

V0.0.4 pushes Velaris further away from the stock Jellyfin layout and more toward a dedicated streaming interface.

- rotating **Velaris Spotlight** hero with multiple titles
- automatic featured-title selection from the Jellyfin home page
- Spotlight previous/next controls and indicator dots
- automatic Spotlight rotation with reduced-motion support
- Continue Watching / Weiterschauen and Next Up row prioritization
- smarter horizontal rail controls with scroll-state awareness
- larger playback rows on desktop
- streaming-style floating header navigation
- page-state detection for home, browse, details, player and login views
- SPA-aware MutationObserver refresh
- responsive and keyboard-focus handling

## Version archive

Historic releases live in `HistoricVersions/Vx.x.x/`.

Whenever a newer Velaris version is released, the previous version is frozen and moved into `HistoricVersions` so it remains reproducible and accessible.

The previous release is available under `HistoricVersions/V0.0.3/`.

## Recommended installation: Tampermonkey

Velaris includes a ready-to-use userscript loader:

`velaris-loader.user.js`

Install URL:

`https://raw.githubusercontent.com/Homiiboy/Velaris/main/velaris-loader.user.js`

With Tampermonkey installed, open the URL above and confirm the userscript installation.

The loader automatically injects both:

- `dist/velaris.css`
- `dist/velaris.js`

It targets normal Jellyfin Web paths such as `/web/` and `/jellyfin/`. The userscript contains Tampermonkey update metadata and V0.0.4 uses versioned asset URLs to reduce stale cache problems after an update.

## CSS-only installation

If JavaScript is not wanted, paste this into **Jellyfin → Dashboard → General → Custom CSS**:

```css
@import url("https://cdn.jsdelivr.net/gh/Homiiboy/Velaris@main/dist/velaris.css?v=0.0.4");
```

The CSS works without JavaScript; Spotlight generation, automatic rotation, row reordering and custom rail controls are then disabled.

## Manual JavaScript installation

Jellyfin Custom CSS cannot execute JavaScript. If Tampermonkey is not used, load the JavaScript using another custom-script injection method:

```html
<script defer src="https://cdn.jsdelivr.net/gh/Homiiboy/Velaris@main/dist/velaris.js?v=0.0.4"></script>
```

## License

MIT
