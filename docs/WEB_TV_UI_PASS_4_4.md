# Velaris Web/TV UI-Polish-Pass 4.4 – Cinematic Player 3.0

## Ziel
Premium-Player-Oberfläche für **Desktop-Web** sowie **Android TV/Google TV**, ohne die bewährten Jellyfin-Streams, Browser-Codecs, Chromecast-Logik oder Media3 zu ersetzen.

## Desktop-Web
- Neue, eigene Videosteuerung `apps/web/desktop-player44.js` für breite Desktop-Fenster mit Maus (min-width:850px und pointer:fine); iPhone-PWA und Touch-Layout bleiben unverändert.
- Play/Pause, 10 Sekunden vor/zurück, große Zeitleiste, Zeitanzeigen und Titel.
- Automatisches Ausblenden während laufender Wiedergabe und Wiedereinblenden bei Pointerbewegung/Tastaturfokus.
- Tastatur: Space oder K = Play/Pause, Pfeil links/rechts = ±10 Sekunden, F = Vollbild.
- Fullscreen API auf der bestehenden Player-Oberfläche; keine neue Stream-Engine.
- Audio-/Untertitel-Auswahl, **wenn** der Browser für den laufenden Stream `audioTracks`/`textTracks` anbietet. Keine falsche Zusage bei fehlenden Browser-Spuren.
- Qualität greift weiterhin auf die schon vorhandene `#p9-quality-button`-Logik zurück; Cast, Smart Skip und Next-Up bleiben im bestehenden `player9.js`.
- Chrome und Web-Skripte über `?v=2440` aktualisiert, Service Worker `velaris-shell-v55-tv-web-44` inklusive neuer Datei.

## Android TV
- Der native Media3-`PlayerView` bleibt die Wiedergabequelle und sein Standardcontroller bleibt aktiv.
- Eigene fokusfähige Schnellaktionen mit ±10 Sekunden, Audio-/Untertitelmenü, Episodenauswahl und Qualitätsmenü. Die Aktionen sind nur sichtbar, wenn Media3 seine Controller zeigt.
- Die Episodenauswahl fragt bei Jellyfin die Zugehörigkeit der laufenden Folge ab und listet nur tatsächliche Serienfolgen auf. Wechsel nutzt denselben ExoPlayer und vorhandene Playback-Reports.
- Intro-Skip, Titel und Laufzeitanzeige haben verbesserte Kontraste und Fokuszustände. „Nächste Folge“ bleibt aktiv.
- Media-Remote-Keys und D-Pad-Handler bleiben erhalten.

## Grenzen und QA
- **Trickplay-Thumbnail-Scrubbing** ist nicht enthalten: Dafür müssen die vom Server gelieferten Tiles und Koordinaten validiert werden.
- **Desktop-Safari, Touchscreen-Desktop und iOS** behalten ggf. die bisherigen nativen Browser-Controls, soweit nicht im separaten Smartphone/PWA-Pass angepasst.
- Für TV ist bewusst keine vollständige eigene Media3-Seekbar anstelle des nativen Controllers eingebaut worden – das vermeidet Fokusregressionen.
- Alle Browser-JavaScript-Dateien wurden auf Syntax geprüft. **Es gab noch keinen Gradle-Build, Browser-Playback-Test oder TV-Gerätetest.**
- Folgende Tests vor Merge zwingend: Jellyfin-Film und Serienfolge starten, vor-/zurückspulen, Pause, Qualitätswechsel, Untertitel, Next-Up, Intro-Skip, Cast-Start/-Stop, Fullscreen und Escape, Desktop-Tastatur, TV-D-Pad-Fokus, 720p/1080p, Hardware-Remote-Media-Keys, Wechsel zwischen Episoden und Playback-Progress-Reporting.
- Bei Fehlern das UI separat revertieren; Jellyfin-/Cast-Pipeline nicht ändern.

**Status:** Code auf Draft-PR #33, kein Merge/Deployment und kein APK-Build.
