# Velaris 2.1 als ZimaOS-App

Die App-Definition `velaris-compose.yaml` bindet die **bereits vorhandene**
Velaris-Web-App im Repository als eigene, von ZimaOS verwaltete App ein. Sie
verwendet das öffentliche Docker-Image `nginx:1.27-alpine` und startet
einen eigenen Container `velaris-zimaos-web` auf Port **8089**.

Es ist keine zweite selbst gebaute Velaris-Image-Registry erforderlich.
Die ursprüngliche Web-Installation auf Port **8088** bleibt erhalten.

## Warum nicht `velaris-web:local`?

ZimaOS versucht beim Installieren häufig, jedes angegebene Image aus einer
Registry zu ziehen. Ein nur lokal auf dem Server erstelltes
`velaris-web:local` ist dort nicht vorhanden und führt zur Meldung
"Repository existiert nicht". Das öffentliche Nginx-Image löst dieses
Problem, während die eigentliche Velaris-App aus dem Git-Checkout
bereitgestellt wird.

## Einmalige Einrichtung auf ZimaOS

1. Das Git-Checkout aktualisieren:
   ```bash
   cd ~/AppData/Velaris-v2
   git pull origin main
   ```
2. Die lokale ZimaOS-App-Konfiguration mit **echtem absolutem Host-Pfad** erzeugen:
   ```bash
   cd ~/AppData/Velaris-v2
   WEB_DIR="$(realpath apps/web)"
   sed "s|__VELARIS_WEB_DIR__|$WEB_DIR|g" zimaos/velaris-compose.yaml > zimaos/velaris-zimaos-install.yaml
   cat zimaos/velaris-zimaos-install.yaml
   ```
3. Die so erzeugte Datei `zimaos/velaris-zimaos-install.yaml` in
   **ZimaOS → App Store → Install a customized app → Import** einfügen.
   Nicht die unverarbeitete Vorlage mit `__VELARIS_WEB_DIR__` importieren.
4. Prüfen, dass **8089:80** und die beiden Bind-Mounts mit absoluten Pfaden
   angezeigt werden. Wenn ZimaOS noch einen fehlgeschlagenen Velaris-2.0-
   Eintrag führt, diesen vor einem Neuversuch in der App-Verwaltung entfernen.
   **Nicht** die bisherige Installation auf Port 8088 löschen.
5. Installieren und kontrollieren:
   ```bash
   curl -s http://127.0.0.1:8089/ | grep application-version
   sudo docker ps --format 'table {{.Names}}\t{{.Ports}}'
   ```
   Erwartet: `2.1.0` und Container `velaris-zimaos-web`.

Die alte Cast Bridge bleibt auf Host-Port 8766 aktiv und wird weiter
über die bestehende `nginx.conf` verwendet. Falls die Bridge später
entfernt wird, funktionieren Cast-Aufrufe nicht mehr.

## Updates

Die ZimaOS-App verwendet **Bind-Mounts** auf `apps/web` des neuen Repos.
Deshalb erhält sie nach einem `git pull origin main` aktuelle Webdateien
ohne einen neuen Docker-Image-Build. Für Änderungen an Konfiguration,
Caching oder App-Metadaten kann ein Neustart über ZimaOS nötig sein.
Bei einer neuen PWA-Version muss auch der Service-Worker-Cache aktualisiert
werden.

```bash
cd ~/AppData/Velaris-v2
git pull origin main
```

Die App-Kachel ist ein von ZimaOS verwalteter Docker-Dienst mit der
Velaris-Weboberfläche; sie ist keine native Android-TV- oder Smartphone-App.
Die Jellyfin-Mediathek wird nicht verändert.

## Netzwerk und Sicherheit

- Neue App: `http://<ZimaOS-LAN-IP>:8089` (LAN, falls Firewall es erlaubt).
- Alte App: Port 8088 und die bestehende Tailscale-HTTPS-Route bleiben unverändert.
- `8089:80` veröffentlicht den neuen Webserver auf allen Host-Interfaces;
  bei ausschließlicher Tailnet-Nutzung auf `127.0.0.1:8089:80` begrenzen.
- Die beiden Host-Mounts sind schreibgeschützt.
- Keine GitHub Actions nötig.
