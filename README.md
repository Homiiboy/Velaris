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

The current archived release is `HistoricVersions/V0.0.3/`.

## Install CSS

Paste this into **Jellyfin → Dashboard → General → Custom CSS**:

```css
@import url("https://cdn.jsdelivr.net/gh/Homiiboy/Velaris@main/dist/velaris.css");
```

## Install JavaScript

Jellyfin Custom CSS cannot execute JavaScript. Load `dist/velaris.js` with your preferred userscript/custom-script injection method for Jellyfin Web.

```html
<script defer src="https://cdn.jsdelivr.net/gh/Homiiboy/Velaris@main/dist/velaris.js"></script>
```

The CSS works without JavaScript; the Spotlight hero, row reordering and custom rail controls are then disabled.

## License

MIT
