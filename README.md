# Velaris

Velaris is a cinematic interface layer for Jellyfin Web with its own cyan, violet and magenta visual identity.

## Current release — V0.0.5

V0.0.5 expands Velaris beyond the home screen and gives Jellyfin detail pages and playback controls a dedicated cinematic treatment.

### Highlights

- rotating **Velaris Spotlight** with up to six library titles
- Spotlight pauses while hovered/focused and only rotates while visible
- keyboard left/right navigation inside Spotlight
- Spotlight image preloading and more reliable card re-resolution after Jellyfin SPA updates
- smart row classification for Continue Watching / Weiterschauen, Next Up, Latest and Favorites
- custom horizontal rail controls with scroll-state awareness
- cinematic **detail page redesign** with stronger backdrop gradients, oversized title treatment, metadata pills and glass action buttons
- new **Velaris Cinema** detail-page identity marker
- redesigned **player OSD** with glass controls, accent progress styling and Velaris playback badge
- SPA-aware MutationObserver refresh, resize handling and reduced-motion support

## Version archive

Historic releases live in `HistoricVersions/Vx.x.x/`.

Whenever a newer Velaris version is released, the previous version is frozen and moved into `HistoricVersions` so it remains reproducible and accessible.

Current historic releases:

- `HistoricVersions/V0.0.3/`
- `HistoricVersions/V0.0.4/`

## Recommended installation — Tampermonkey

Velaris includes a ready-to-use userscript loader:

`velaris-loader.user.js`

Install URL:

`https://raw.githubusercontent.com/Homiiboy/Velaris/main/velaris-loader.user.js`

With Tampermonkey installed, open the URL above and confirm the userscript installation. The loader automatically injects the matching, pinned V0.0.5 copies of:

- `dist/velaris.css`
- `dist/velaris.js`

The loader includes Tampermonkey update metadata so newer Velaris loader versions can be detected automatically.

## CSS-only installation

If JavaScript is not wanted, paste this into **Jellyfin → Dashboard → General → Custom CSS**:

```css
@import url("https://cdn.jsdelivr.net/gh/Homiiboy/Velaris@72896b5c23da41bf14f082ca1138c8b1fb2cdaca/dist/velaris.css");
```

The CSS-only mode keeps the visual redesign, but JavaScript-powered features such as Spotlight generation, row reordering, dynamic detail-page classes and player enhancements are reduced or unavailable.

## Manual JavaScript installation

If Tampermonkey is not used, load the matching JavaScript with another custom-script injection method:

```html
<script defer src="https://cdn.jsdelivr.net/gh/Homiiboy/Velaris@72896b5c23da41bf14f082ca1138c8b1fb2cdaca/dist/velaris.js"></script>
```

## License

MIT
