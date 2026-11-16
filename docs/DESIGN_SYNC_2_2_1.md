# Velaris – Design-Synchronisierung 2.2.1

## Zielbild: zwei responsive Layout-Familien

**Smartphone (Expo / native Android + iOS) ↔ iPhone-PWA**
- Oben: Velaris-Logo, Suchfunktion, Einstellungen und Profil.
- Darunter: horizontal scrollbar für alle unterstützten Kategorien.
- Unten: fünf permanente Haupt-Tabs in derselben Reihenfolge: Filme, Serien, Start, Anime, Anime Filme.
- Startseite: linksbündiger Hero mit Aktionen, Fortschritts-/Highlight-Punkten und scrollbaren Medienreihen.
- Gleiche Kategorie-Akzentfarben und ein dunkler Grundhintergrund.
- Navigation muss die Safe-Areas der Geräte berücksichtigen.

**Desktop-Web ↔ Android TV / Google TV**
- Oben: Velaris-Schriftzug und horizontale Kategorienavigation in gemeinsamer Reihenfolge.
- Startseite: großer Hero, Medienreihen, Kategorien und Details.
- TV: D-Pad-Fokusrahmen, keine Touch-Hover-Abhängigkeit; Web: Tastatur-/Mausbedienung.
- Auf beiden Plattformen dieselben Markentokens und Kategorie-Akzente.

## Zentrale Designquelle

`packages/velaris-design/brand.json`: `theme`, `categoryAccents`, `navigation`, `layouts`.

Die Datei ist direkt mit Expo und TV verknüpft. Das Web besitzt aktuell noch gespiegelte CSS-/JS-Werte. Der Test `scripts/check-unified.cjs` prüft Teile der Layout-Parität, ersetzt jedoch keine visuelle Abnahme.

## In diesem Pass umgesetzt

1. PWA: Auf schmalen Viewports horizontale Kategorie-Chips oben und fünf feste Haupt-Tabs unten; Desktop-Navigation getrennt.
2. Expo: Kategorien-Reihenfolge wie PWA, sichtbare Profil-/Einstellungsaktionen auch außerhalb der Startseite, linksbündiger Hero.
3. Expo: „Meine Liste“ mit echter Jellyfin-Favoritenabfrage als eigener Bildschirm.
4. TV: Kategorien in Desktop-Web-Reihenfolge, einschließlich dem bereits existierenden `showFavorites()`-Bereich.
5. Gemeinsame Layout-Kontrakte und Regressionstests für die strukturierte Navigation.
6. Quellcode-Versionsangaben Web, Expo und TV: 2.2.1 (Geräte-Builds bleiben unabhängig).

## Noch nicht als pixelgenau abgenommen

- Schriftarten und exakte Typografie (Web: Inter; Android TV: native Schrift; Expo: Systemschrift).
- Einheitliche Höhen, Fokusrahmen, Buttons, Postergrößen und Zeilenabstände auf allen Bildschirmgrößen.
- Gleiche Animationen und Übergänge auf Web, Expo und TV.
- Der TV-Header setzt die Navigation innerhalb einer horizontalen Kopfleiste um, Desktop-Web aktuell in einer eigenen oberen Kategorienzeile: dieselbe Hierarchie, aber noch nicht exakt dieselbe Zeilenanordnung.
- YouTube ist bisher keine gemeinsame, funktionsfähige Kategorie auf allen nativen Plattformen; nicht vorhandene Funktionen werden nicht als fertig dargestellt.
- Reale visuelle Vergleichstests: iPhone-PWA, Android-Smartphone, Web-Desktop, Google TV.

## Nächste Testschritte

1. Web auf ZimaOS mit `docker compose up -d --build` bereitstellen; auf iPhone und Desktop Screenshots von Start, Filmen, Serien, Meine Liste und Details aufnehmen.
2. Expo mit `npm ci`, `npm run typecheck` und anschließendem Android-/iOS-Gerätetest prüfen; Build-Nummer 11.
3. TV mit `:app:lintDebug` und `:app:assembleDebug` prüfen; D-Pad-Fokus und Safe-Areas am echten TV testen; Build-Nummer 11.
4. Unterschiede bei Typografie, Medienkarten, Header und Detailseiten pro Bildschirm anhand der Vergleichsbilder beheben.
5. Player und Cast nicht ohne isolierten Regressionstest ändern: die iPhone-PWA benötigt weiterhin den vor-Chromecast wiederhergestellten Player.

**Status:** Quellcode-Pass umgesetzt, Syntax und strukturelle Quellen geprüft; kein geräteübergreifender visueller Abnahmetest und keine automatische Installation.
