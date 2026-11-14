# Velaris UI-Pass 2.0.0 – Kategorie-Akzentfarben

## Ziel
Das dunkle Grunddesign bleibt unverändert (`#08080D`). Die aktive Kategorie
bestimmt die Akzentfarbe auf Web, Smartphone und TV:

| Bereich | Token | Hex |
| --- | --- | --- |
| Startseite | home | `#7C5CFC` |
| Filme | movies | `#46D369` |
| Serien | series | `#7DD3FC` |
| Anime | anime | `#FF8A00` |
| Anime Filme | animeMovies | `#FFD43B` |
| YouTube (vorbereitet) | youtube | `#FF0033` |

Verbindliche Token-Quelle: `packages/velaris-design/brand.json`.
YouTube hat **noch keine** veröffentlichte Navigationsseite. Für Animation,
Cartoons und andere Bereiche bleibt das vorhandene Standard-/Profiltheme erhalten.

## Implementierung
- Web: Das aktuell aktive Hauptmenü setzt die CSS-Variable `--accent`;
  Webmanifest, Versions-Header, HTML-Caches und Service Worker sind auf 2.0.0 gesetzt.
- Smartphone: Expo-Router-Segment bestimmt den Akzent in der Theme-Context-API;
  Tabs, Bibliothekskopf, Poster-Fokus und Fortschrittsbalken nutzen ihn.
- TV: `activeSection` aktualisiert die Akzentauflösung in `VelarisDesign`.
  Eisblaue und gelbe ausgewählte Navigationschips verwenden dunkle Schrift.
- Plattformen: TV 2.0.0 (`versionCode 9`), Smartphone 2.0.0
  (`versionCode 9`), Web 2.0.0.

## Manuelle Abnahme vor Release
1. Startseite öffnen: schwarzer Hintergrund, violette Akzente.
2. Filme/Serien/Anime/Anime Filme wechseln: jeweiliger Akzent, keine Änderung
   der dunklen Flächen oder weißen Standardtexte.
3. Auf TV mit D-Pad Navigations- und Poster-Fokus testen. Gelb/Eisblau:
   ausgewählte Menüpunkte müssen deutlich lesbar sein.
4. Auf iPhone PWA: aus der Home-Screen-App starten, Kategorien wechseln,
   harte Aktualisierung durchführen und kontrollieren, dass keine alten
   CSS-/JavaScript-Dateien aus dem Service-Worker-Cache verwendet werden.
5. Jellyfin-Wiedergabe, Profilwechsel, Suche und Zurück-Navigation testen;
   keine Regression durch Kategorie-Wechsel.
6. Smartphone: Android und iOS Tab-Leiste, Scrollen und Poster-Fortschritt prüfen.
7. Erst nach bestätigter Abnahme einen gezielten Build/Deployment starten.

## Status
Quellcode-UI-Pass implementiert, **kein Gerätetest oder Produktiv-Deployment**
durchgeführt. Es wurde kein GitHub-Actions-Workflow manuell gestartet.
