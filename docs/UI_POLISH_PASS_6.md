# Velaris UI Polish Pass 6 — TV + Smartphone

Stand: 12. Oktober 2026. **Nur** `apps/tv` und `apps/mobile`; `apps/web` bleibt unverändert.

## Umsetzung

| Punkt | TV | Smartphone |
| --- | --- | --- |
| 1 Cinematic Hero | Echtes Crossfade mit überlagernden Ansichten statt Schwarzblende | Rotierende Highlights mit Einblendung, manueller Auswahl |
| 2 Posterfokus | Dezente 2%-Vergrößerung, vorhandene Focus-Ränder | Federgestützte Fokus-/Touch-Animationen und abgestimmtes Feedback |
| 3 Player | Vorhandener Media3-Controller, Titel und Zeit nur mit sichtbarer Leiste | Bestehende Native Controls; Zeitdarstellung in der Player-Ansicht, Intro-/Next-Overlays überarbeitet |
| 4 Filmdetails | Bestehende einheitliche Cinematic-Hero-Details | Episoden-Press-Feedback/Barrierefreiheit verbessert |
| 5 Profile | Vorhandener Profil-Hero und Avatar-Fokus | Touch-Feedback beim Profil- und Avatarwechsel |
| 6 Skeletons | Vorhandene pulsing Placeholder beim Laden | Vorhandene Skeleton-Screens |
| 7 Kategorien | Kurze Seiten-Einblendung | Vorhandene Navigation-Chips mit Touch-Feedback |
| 8 Abstände | Bestehende TV-safe-area-Abstände für Reihen | Bestehendes Designsystem und gemeinsame Abstände |
| 9 Weiterschauen | Bestehende Fortschrittsbalken und Restzeit | Bestehende Fortschrittsbalken und Restzeit |
| 10 Empfehlungen | Einblenden von geladenen Home-Reihen | Home-Reihen erscheinen animiert |
| 11 Fehlende Poster | Bestehender neutraler Hintergrund | Velaris-Platzhalter bei Bildfehler |
| 12 TV-Leistung | Animationsbegrenzung, Bild-Cache, reduzierte Animationsgröße | — |
| 13 Touch | — | Touch-/Press-Feedback auf Postern, Episoden und Profilen |
| 14 TV-Zurückfokus | Fokus auf vorher gewählte Poster-Karte auf Home wiederherstellen | — |
| 15 Icons/Buttons | Bestehendes native TV-Design | Gemeinsames Theme und konsistente Klickflächen |
| 16 Leerzustände | Meldung bei leerer Bibliothek und bestehender Jellyfin-Retry | Bestehende Empty States und Retry |

## Bewusst beibehalten

- TV: VELARIS oben links im Player.
- TV: Filmtitel ohne dunklen Kasten, Wiedergabezeit nur bei eingeblendeten Media3-Steuerelementen.
- TV: IntroSkipper, D-Pad, Weiterschauen-Position und ExoPlayer-Streaming unverändert.
- Smartphone: Native Videosteuerung, Jellyfin-Synchronisation und bestehende Profile.
- Web-App wurde in diesem Durchlauf nicht bearbeitet.

## Validierung

Alle Änderungen liegen als Commits im Hauptzweig. Es wurden **keine** grünen Android-TV-APK- oder Expo-Typecheck-Ergebnisse über die verfügbaren GitHub-Statusabfragen bestätigt. Native Gerätetests sind noch erforderlich.

Empfohlene lokale Checks:

```bash
cd apps/mobile
npm ci
npm run typecheck
```

```bash
cd apps/tv
gradle :app:lintDebug :app:assembleDebug
```

### Manuelle Regression

- TV: Hero mehrfach wechseln lassen, Fokus durch Poster und Reihen bewegen, Film- und Seriendetails öffnen und zurückgehen.
- TV: Intro überspringen; „Weiterschauen“ mit Position; Media3-Leiste ein- und ausblenden; Player beenden.
- TV: Leere Jellyfin-Bibliothek und vorübergehenden Verbindungsfehler simulieren.
- Smartphone: Hero-Titel wechseln und Punkte antippen; Poster und Folgen öffnen; Profile und Avatare bearbeiten.
- Smartphone: Player mit Untertiteln und Auto-Next; Filmfortschritt und Favoriten prüfen.
- Beide: Navigationswechsel ohne abgeschnittene Poster oder verlorene Fokus-/Touch-Bedienbarkeit.

Pass 6 = Code-Umsetzung abgeschlossen; Release-Freigabe erst nach erfolgreichen Builds und Geräteregressionen.
