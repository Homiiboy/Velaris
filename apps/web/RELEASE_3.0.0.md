# Velaris Web & iPhone-PWA — Stable 3.0.0

**Release-Datum:** 26. November 2026  
**Status:** Stable (für die bestätigte ZimaOS-/iPhone-PWA-Installation)  
**Bereich:** `apps/web` – Desktop-Web und installierte iPhone-PWA.

## Freigegebener Funktionsstand

- Responsive Velaris-Oberfläche mit Mediathek, Suche, Filmen, Serien, Anime, Sammlungen, Hero, Favoriten und „Weiterschauen“.
- Desktop-Web und iPhone-PWA nutzen denselben Web-Code mit geräteoptimierter Navigation.
- Jellyfin-Anmeldung, Profile und Wiedergabefortschritt.
- iPhone-PWA-Streaming über den zuvor bewährten `PlaybackInfo`-basierten Startpfad. Dadurch wird kein Stream vor der Medienquellenauswahl blind gestartet.
- Violetter Chromecast-Button mit separatem Auswahlfenster.
- Chromecast-Wiedergabe über die ZimaOS Cast Bridge mit Jellyfin-Medienquellenaushandlung (Direct MP4/H.264/AAC bzw. HLS/Transcoding).
- Stabiler Cast-Verbindungsaufbau: der PyChromecast-Zeroconf-Browser bleibt bis zum Ende des Cast-Bridge-Dienstes aktiv; der zuvor beobachtete `RequestTimeout` nach `GET /devices` wird damit vermieden.

## Abnahme und Grenzen

Am 26.11.2026 bestätigte der Betreiber nach dem Cast-Zeroconf-Fix: **„Jetzt funktioniert es“**. Zuvor war bestätigt worden, dass der iPhone-PWA-Stream wieder läuft. Diese Rückmeldungen beziehen sich auf seine konkrete Umgebung und sind keine umfassende Kompatibilitäts- oder Lastprüfung für alle Geräte.

Der Web-CI-Workflow prüft Webdateien und die Cast-Bridge-Regressionstests. Ein GitHub-CI-Lauf testet keine echte Chromecast-Hardware. Die TV-APK und die native Smartphone-App sind **nicht** Teil von Stable 3.0.0 und behalten ihre eigenen Versionsstände.

## Updates / Deployment auf ZimaOS

```bash
cd ~/AppData/Velaris
git switch main
git pull --ff-only origin main
cd apps/web
sudo docker compose up -d --build
sudo docker compose ps
```

`apps/web/index.html` und das PWA-Manifest melden Version `3.0.0`.
Der Service Worker verwendet den Cache `velaris-shell-v68-web-pwa-3.0.0-stable`, damit nach dem Deployment neue Web-Assets geladen werden.

Die installierte PWA auf dem iPhone nach dem Deployment vollständig schließen und wieder öffnen. Den bestehenden Jellyfin-Login nicht ohne Anlass löschen.

## Stabilitätsregel

Nachfolgende Arbeiten sollen den iPhone-`PlaybackInfo`-Startpfad und den Lebenszyklus der Cast-Bridge-Geräteerkennung nicht ohne reproduzierbaren Fehler und Regressionstests verändern. Chromecast/Player und TV/Smartphone-Versionen bleiben voneinander entkoppelt.
