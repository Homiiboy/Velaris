# Velaris – Web/TV UI-Polish-Pass 4.2

## Ziel und Abgrenzung

Dieser Pass baut auf **Web/TV Pass 4.1** auf: große Serien-Detailseiten, ein filmischer „Wer schaut?“-Bildschirm und bessere Sammlungsansichten. Die mobile Smartphone-/iPhone-PWA-Layoutfamilie bleibt davon getrennt. Player, Jellyfin-Authentifizierung, Cast und die Profile als Jellyfin-Benutzerkonten bleiben technisch unverändert.

## Desktop-Web

- **Serien-Details:** höherer Backdrop, dunkleres cinematic Overlay, ausgeprägtere Titelhierarchie, größere Staffelwahl und breite Episodenkarten mit größerem Artwork, Metadaten, Fortschritt und Focus-/Hover-Zustand
- **„Wer schaut?“:** Film-/Serien-Backdrop mit dunklem Blur und größeren Profilkarten; wenn der lokale Medienzustand noch leer ist, werden öffentliche Metadaten des angemeldeten Jellyfin-Kontos für den Hintergrund geladen; nur vorhandene Backdrops werden verwendet
- **Sammlungen:** größerer Backdrop-Banner, deutlichere Titelzahl und eigene Überschrift über dem Medienraster; bestehende Jellyfin-Mitgliedschaft und chronologische Sortierung bleiben erhalten
- Styles ausschließlich für Desktop mittels `@media(min-width:850px)`; iPhone-PWA bleibt bei ihrem eigenständigen Layout

## Android TV / Google TV

- **Serien:** höherer Header (545 dp), größere Episoden-Thumbnails (290 × 163 dp), breitere vertikale Abstände, deutlicherer Staffelauswahl-Button; D-Pad-Aktionen unverändert
- **Sammlungen:** höheres Bild (455 dp), größere Titel- und Beschreibungselemente, verbesserte Backdrop-Auflösung
- **Profile:** verbreiterte Profilspalte (410 dp), größere Avatare und Profilkarten mit verbesserter Fokusdarstellung; rechter Film-/Serien-Hintergrund bleibt erhalten
- Keine Änderung an `activateJellyfinProfile`, Avatar-Speicherung oder Jellyfin-Login

## Statische Prüfung

- `apps/web/main.js` und `apps/web/sw.js`: gültige JavaScript-Syntax
- PWA-Cache-/Asset-Versionen wurden von Pass 4.1 auf Pass 4.2 aktualisiert
- TV-Änderungen im Kotlin-Quelltext vorhanden; formaler Kotlin-/Gradle-Build wurde nicht ausgeführt

## QA vor Merge / Deployment

1. Desktop-Web (1280×720 / 1920×1080): Serien öffnen, Staffel 1 auswählen, andere Staffeln wählen, Episoden starten; Fortschritt und Intro-Skip erhalten
2. Desktop-Web: „Wer schaut?“ direkt nach neuem Browserstart öffnen; Backdrop-Laden, Profilwechsel und Neuanmeldung prüfen
3. Desktop-Web: Sammlungen ohne Backdrop, mit leerem Inhalt und mit mehreren Filmen testen
4. Android TV: D-Pad-Fokus auf Profilkarten, Staffel-Buttons, Episoden und Sammlungen kontrollieren; keine abgeschnittenen Inhalte bei 720p/1080p
5. Android TV: Zurück-Navigation, Profilwechsel, Filmdetails, Episoden und Start aus Sammlung testen
6. iPhone-PWA/Smartphone: keine visuellen Regressionen in der mobilen Layoutfamilie
7. Bildqualität und Ladezeit: größere Backdrops vergleichen; Performance auf dem physischen TV prüfen

**Status:** Code im Draft-PR, nicht gemergt, nicht deployt, kein Android-Build oder echter Gerätetest durchgeführt.
