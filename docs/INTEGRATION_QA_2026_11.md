# Velaris – Integrations-QA (17.11.2026)

Zwei PRs als echter Git-Merge-Commit zusammengeführt: Mobile/PWA #32 und Desktop-Web/TV #33.

- Mobile/Expo, PWA-Safari-Fallback und mobile Fullscreen-Scripte aus #32.
- Android-TV, Desktop-Web-Cinematic und Desktop-Player aus #33.
- Gemeinsamer Web-Player lädt **beide** UI-Controller, die per Breakpoint/Pointer getrennt werden.
- Gemeinsame Profilwahl: editierbare PWA-Profilnamen/-farben und rotierende Desktop-Hintergründe.
- CSS von beiden Passes unverändert hintereinander zusammengeführt und durch Breakpoints begrenzt.
- Dockerfile und Service Worker enthalten beide neuen JavaScript-Dateien.
- Alle Web-Assets aus einem gemeinsamen Release-Stand, Cache-Bust v2500 und Cache v56.

## Ausstehende Freigabegates
- CI auf diesem Kombinationsbranch: Web, Unified/Mobile-Typecheck, Android TV.
- Echttests: Chrome/Edge, Safari/PWA, Android-Expo-APK und Android-TV-Hardware mit Jellyfin, Cast und Intro-Skip.
- Mobile npm-audit-Sicherheitswarnungen gesondert bewerten.
- Bis dahin keine Änderungen an main, keine ZimaOS-Bereitstellung.
