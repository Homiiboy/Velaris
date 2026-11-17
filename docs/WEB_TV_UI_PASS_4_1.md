# Velaris – Web/TV UI-Polish-Pass 4.1

## Ziel

Cinematic Startseite für **Desktop-Web und Android TV/Google TV** bei unveränderter mobiler Layout-Familie. Drei Schwerpunkte: Immersive Hero 3.0, Premium-Poster-Fokus und Top-10-Rangnummern.

## Desktop-Web (`apps/web`)

- Desktop-Hero wächst auf 560 px, mit verstärktem unteren und seitlichen Verlauf. Die Darstellung bleibt auf kleinen Desktop-Fenstern sowie niedrigen Viewport-Höhen abgestuft.
- Das originale Jellyfin-Logo wird bevorzugt; der Filmtitel dient als Fallback. Metadaten, Genre, Beschreibung und vorhandene Aktionen bleiben funktionsfähig.
- Backdrop-Bildbreite auf 1920 px erhöht (abhängig von tatsächlichen Jellyfin-Artworks).
- Filmkarten mit bis zu 5,2 % Fokusvergrößerung, Farbkontur und stärkerem Schatten; Hover und Tastatur-Fokus verwenden dieselben Visuals.
- Top-10-Reihe mit größeren, konturierten Rangzahlen und leichtem Fokus-Glow. Das Ranking beruht weiterhin auf denselben vorhandenen Jellyfin-Daten.
- CSS ist durch `@media(min-width:850px)` auf das Desktop-Layout begrenzt. Die neuen Dateien haben Asset-Version `2410` und der Service Worker einen neuen Cache-Namen.

## Android TV (`apps/tv`)

- Hero und Carousel-Wrapper auf 560 dp erhöht, um Cropping zu vermeiden. Film-Backdrop mit 1920 px angefordert; Gradients, Logo, Titel und Schaltflächen angepasst.
- TV-Fokusvergrößerung auf 5,2 % und erhöhter Z-Abstand, ohne die D-Pad-Reihenfolge zu verändern.
- Top-10-Zahlen auf 137 sp vergrößert, mit hellerer Konturwirkung und größeren Layoutabständen.
- Film-/Episoden-Player, Medienabruf, Profilwahl und Navigation absichtlich unverändert.

## Prüfung und Freigabe

**Statisch geprüft:** Web-JavaScript ist syntaktisch gültig; die erwarteten TV-Änderungen sind im Kotlin-Quelltext vorhanden.

**Noch ausstehend:**
1. Web lokal oder auf ZimaOS deployen und mit Desktop-Auflösungen 1280×720, 1920×1080 sowie 4K-Auflösung vergleichen.
2. Auf Web die Hero-Buttons **Abspielen/Mehr Infos**, Hero-Autowechsel und Fokus/Tastatur prüfen.
3. Auf Android TV einen Debug-Build erstellen und auf Emulator und echter Fernbedienung testen: D-Pad, erste/letzte Karte, Fokusrahmen, Top-10-Scroll.
4. Bildqualität und Ladezeit prüfen; größere Backdrop-Anfragen sollen nicht zu unnötigem Transcoding oder merklichem Datenmehrverbrauch führen.
5. Smartphone und iPhone-PWA auf regressionsfreie Darstellung prüfen.
6. TV-Layouts auf kleinen/niedrigen 720p-Fenstern und TV-Safe-Areas prüfen.

Die Codeänderungen sind **nicht** gemergt und **nicht** deployt. Versionierung und App-Release werden nach visueller Freigabe getrennt durchgeführt.
