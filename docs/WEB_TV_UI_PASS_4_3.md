# Velaris – Web/TV UI-Polish-Pass 4.3

## Ziel
Pass 4.3 ergänzt die bereits gespeicherten Pässe 4.1 und 4.2 um **Adaptive Navigation**, dezente **artworkbasierte Ambient-Effekte** und **Micro-Animationen**. Desktop-Web und Android TV behalten ihre gemeinsamen Designprinzipien, aber verwenden weiterhin gerätespezifische Interaktionen.

## Desktop-Web
- Die bestehende Sticky-Navigation verkleinert sich ab ca. 72 px Window-Scroll von 82 auf 66 px und erhält stärkeren Blur und Schatten; Kategorien, Suche und Profil bleiben erreichbar.
- Der dekorative Ambient-Layer wird aus Backdrop- oder Posterbildern des aktuell hervorgehobenen Jellyfin-Mediums erzeugt. Hover, Tastaturfokus und Hero-Rotation aktualisieren das Artwork.
- Der Effekt ist absichtlich schwach (13 % Deckkraft, 65 px Blur), verdeckt keine Controls, ist nicht interaktiv und wird **nur ab 850 px Bildschirmbreite** eingesetzt.
- Ein einziger passiver Scroll-Listener übernimmt die Headerzustände auch nach Ansichtswechseln. Die mobile PWA erhält weder den zusätzlichen Layer noch eine Navigation-Veränderung.
- Kürzere konsistente Übergänge für Desktop-Navigation, Hero, Poster und Episodenkarten; `prefers-reduced-motion` wird beachtet.
- `index.html` verwendet `style.css?v=2430` und `main.js?v=2430`; Service-Worker-Cache ist entsprechend erhöht.

## Android TV
- Der vorhandene 82-dp-Header bleibt an seiner Position. Beim Scrollen wechselt er zu einer deckenderen, kompakter gepolsterten Darstellung. **Kein Geometrie-Wechsel der D-Pad-Kategorien**, damit der Fokus stabil bleibt.
- Home-, Serien- und Sammlungs-Hero erhalten ein subtiles zweites Backdrop-Layer (640 px), das auf Android 12+/API 31+ weichgezeichnet wird; auf älteren TVs bleibt es nur schwach transparent.
- Keine zusätzliche Farb-/Bildanalyse auf dem Hauptthread. Der Layer ist nicht fokussierbar und kann die Wiedergabe nicht steuern.
- Seitenübergänge respektieren die vorhandene Einstellung `ui_animations` und systemseitig deaktivierte Animationen.

## Validierung
- Web-JavaScript-Syntaxprüfung erfolgreich, CSS-Selektoren und HTML-Cache-Versionsstrings vorhanden.
- TV-Quelltext auf Komponenten, Handler und ausgeglichene Klammern geprüft; **kein Gradle-/Android-Compile und kein Gerätetest** durchgeführt.

## Vor Merge/Deployment testen
1. Desktop-Web: Startseite scrollen → Header wird kompakt → zurück nach oben; Suche, Profil und alle Nav-Kategorien bleiben anklickbar.
2. Desktop-Web: Hero-Autowechsel, Poster-Hover und Tab-Fokus, Detailseite, Sammlungen; Ambient bleibt subtil und beeinflusst nicht die Lesbarkeit.
3. Desktop-Web: Browserzoom sowie 1280×720, 1920×1080, 4K; „Reduce Motion“ testen.
4. Android TV: D-Pad-Navigation und -Scroll auf Start, Serien-/Sammlungsansicht; Fokusrahmen, Safe Areas und laufende Animationen überprüfen.
5. TV-Geräte mit API 26–30 und 31+: Blur-Fallback, Speicherverbrauch und Ladezeiten bei Backdrops prüfen.
6. Android TV: Profilwechsel und Abspielen/Zurück; Medienbildwechsel darf kein Freeze verursachen.
7. Smartphone/iPhone-PWA und laufenden mobilen PR #32 getrennt halten; Layout-Regressionsprüfung nach Merge.

**Status:** Draft-PR #33, nicht gemergt, nicht deployt; realer UI-/TV-Test steht aus.
