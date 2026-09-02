# Velaris

Velaris is a cinematic interface layer for Jellyfin Web with its own cyan, violet and magenta visual identity.

## V0.0.3

This is the first Velaris build that combines CSS with a JavaScript enhancement layer.

- cinematic dark streaming UI
- redesigned header, cards, details, dialogs and progress bars
- generated **Velaris Spotlight** hero on the home page
- automatic recognition of Continue Watching / Weiterschauen and Next Up rows
- playback rows prioritized below the hero
- custom horizontal rail controls
- desktop Velaris branding
- SPA-aware MutationObserver refresh
- responsive and reduced-motion handling

## Version archive

Historic releases live in `HistoricVersions/Vx.x.x/`.

Whenever a newer Velaris version is released, the previous version is frozen and moved into `HistoricVersions` so it remains reproducible and accessible.

## Recommended installation: Tampermonkey

Velaris includes a ready-to-use userscript loader:

`velaris-loader.user.js`

Install URL:

`https://raw.githubusercontent.com/Homiiboy/Velaris/main/velaris-loader.user.js`

With Tampermonkey installed, open the URL above and confirm the userscript installation.

The loader automatically injects both:

- `dist/velaris.css`
- `dist/velaris.js`

It currently targets normal Jellyfin Web paths such as `/web/` and `/jellyfin/` and includes Tampermonkey update metadata so loader updates can be detected automatically.

## CSS-only installation

If JavaScript is not wanted, paste this into **Jellyfin → Dashboard → General → Custom CSS**:

```css
@import url("https://cdn.jsdelivr.net/gh/Homiiboy/Velaris@main/dist/velaris.css");
```

The CSS works without JavaScript; the Spotlight hero, row reordering and custom rail controls are then disabled.

## Manual JavaScript installation

Jellyfin Custom CSS cannot execute JavaScript. If Tampermonkey is not used, load the JavaScript using another custom-script injection method:

```html
<script defer src="https://cdn.jsdelivr.net/gh/Homiiboy/Velaris@main/dist/velaris.js"></script>
```

## License

MIT
