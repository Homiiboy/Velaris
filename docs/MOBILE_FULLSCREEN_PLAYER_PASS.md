# Velaris – Fullscreen Player Pass (Smartphone & iPhone-PWA)

## Implementierung

- **Expo-App**: eigener Vollbildmodus als React-Native-Modal über dem bestehenden `expo-video`-Player. Kein zweiter Playback-Controller; `VideoPlayer` bleibt für Wiedergabe, Jellyfin-Progress-Reporting und Mediensegment-Skips erhalten.
- Im kleinen Player nur Play/Pause und Vollbild; im Vollbild eigene Overlay-Steuerung mit zurück, Pause/Play, ±10 Sekunden, Zeitleiste, Laufzeit, Intro-Skip, nächste Episode sowie Auswahl von Audio, Untertiteln, Qualität und Episoden.
- `apps/mobile/app.json` erlaubt Hoch-/Querformat, damit die App im Vollbild bei Gerätedrehung quer angezeigt werden kann. Dieser Konfigurationswechsel wirkt auch außerhalb des Players und muss geräteübergreifend geprüft werden.
- **PWA**: `fullscreen-controls.js` hängt eigene mobile Bedienelemente an **beide** bewährten Player-Implementierungen (`player9.js`, `player9-classic.js`) an. Die PWA wird bereits als viewport-füllendes Overlay angezeigt; der neue Vollbild-Button aktiviert den immersiven Zustand und fordert Web Fullscreen und Querformat nur an, wenn die Plattform das unterstützt.
- Die PWA versucht nicht `webkitEnterFullscreen`, weil iOS dabei die eigenen Velaris-Bedienelemente durch native Safari-Steuerung ersetzen kann.
- PWA: Zeitleiste, ±10s, Play/Pause, Episodenauswahl und, soweit der HTML5-Video-Stream sie verfügbar macht, Audio-/Untertitelspuren.
- Bestehender HLS-/MP4-Fallback, AirPlay/Chromecast, Wiedergabestatus und Server-PlaybackInfo werden in ihren bisherigen Implementierungen belassen.

## Bewusste Grenzen

- **Trickplay-Bildvorschau** ist noch nicht integriert. Der Server bietet Tile-JPGs, aber die Tiles müssen anhand ihrer Metadaten korrekt ausgeschnitten und nach Position zugeordnet werden; ohne verifizierte Metadaten werden keine Thumbnail-URLs geraten.
- Safari und installierte iPhone-PWAs können programmatisches Rotieren beziehungsweise die Fullscreen-API beschränken. In diesem Fall bleibt Velaris bildschirmfüllend und rotiert mit der vom Betriebssystem erlaubten Ausrichtung.
- Nicht alle HTML5-/Safari-Streams stellen umschaltbare `audioTracks`/`textTracks` bereit. Das PWA-Menü zeigt nur tatsächlich vorhandene Tracks.
- Native TypeScript-/Expo-Builds und Wiedergabetests auf realen Geräten wurden **nicht** ausgeführt; JavaScript-Syntax und JSON-Konfiguration wurden statisch geprüft.

## Geräte-Testcheckliste

1. Android: Inline-Player starten → Vollbild → Play/Pause → ±10s → Seekbar → zurück; hoch und quer testen.
2. Native App: Folgenwechsel, Mediensegmente, Untertitel/Audio, Qualität, PiP und Wiedergabefortschritt prüfen.
3. iPhone-PWA: Safari und Home-Screen-PWA testen; insbesondere ersten Video-Start durch Nutzeraktion, HLS und MP4-Fallback.
4. PWA: Vollbild-Button, Drehung, Auto-Hide der Controls, Seekbar, Episoden-Sheet, „Intro überspringen“ testen.
5. Chromecast/AirPlay nicht nur auf Geräteerkennung, sondern auf tatsächlichen Wiedergabestart und Rückkehr testen.
6. Eingebaute App gegen `main` visuell vergleichen (Hero, Floating Navigation, Profilwahl, Player); prüfen, dass Fehler, Einstellungen, Scroll und Safe Areas nicht abgeschnitten sind.

## Bereitstellung

Aus PR #32 noch **nicht gemergt** und noch **nicht deployt**. Für PWA müssen die neuen Versionen von HTML, JS, CSS und Service Worker zusammen bereitgestellt werden. Für Expo ist ein neuer nativer Build erforderlich, weil `app.json` die zulässigen Ausrichtungen ändert.
