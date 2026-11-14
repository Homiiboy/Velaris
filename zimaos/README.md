# Velaris als verwaltete ZimaOS-App installieren (2.0.0)

Diese Anleitung richtet die **bereits vorhandenen Velaris-Web- und Cast-Bridge-Images**
als **ZimaOS-verwaltete Docker-App mit eigener Kachel** ein. Es handelt sich um
dieselbe Webanwendung, die ZimaOS als App verwaltet – nicht um ein natives
ZimaOS-Desktopprogramm oder einen neuen Jellyfin-Server.

App-Manifest: [velaris-compose.yaml](velaris-compose.yaml).

## Voraussetzungen

Die bereits bestehende Installation unter
`~/AppData/Velaris-v2/apps/web` muss zuvor **einmal erfolgreich gebaut**
worden sein. Das ist beim aktuellen Velaris Web 2.0.0 bereits erfolgt.

Prüfen:
```bash
sudo docker image inspect velaris-web:local velaris-cast-bridge:local >/dev/null && echo "Images vorhanden"
sudo docker ps --format 'table {{.Names}}\t{{.Ports}}'
```

Der ZimaOS-App-Importer soll die **lokal gebauten Docker-Images** verwenden.
Je nach ZimaOS-Version akzeptiert der Installer keine nur lokal vorhandenen
Images oder versucht, sie aus einer Registry herunterzuladen. In diesem Fall
**nicht** weitere Container starten, sondern zunächst ein pullbares Registry-
Image bereitstellen oder den bestehenden Compose-Stack als App importieren.

## Migration ohne doppelte Container

1. Die laufenden Container prüfen und gegebenenfalls deine bisherigen
   Compose-Konfigurationen/Umgebungswerte sichern. Nicht die Verzeichnisse
   und keine Jellyfin-Daten löschen.
2. In `~/AppData/Velaris-v2/apps/web`:
   ```bash
   sudo docker compose down
   ```
   Dieser Befehl entfernt nur die Container des Compose-Projekts, nicht
   die gebauten Images und nicht deine Jellyfin-Mediathek.
3. In ZimaOS **App Store → Install a customized app → Import** wählen.
   Die YAML aus `zimaos/velaris-compose.yaml` einfügen oder importieren
   (je nach Version ist eine Compose-YAML oder Datei möglich).
4. App-Name `Velaris`, Icon und Port `8088` kontrollieren und installieren.
5. ZimaOS sollte danach eine Velaris-Kachel mit Start/Stopp/Neustart anzeigen.
   Prüfen:
   ```bash
   sudo docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
   curl -s http://127.0.0.1:8088/ | grep application-version
   ```
   Erwartet: Velaris 2.0.0.

**Netzwerk:** Anders als die bisherige localhost-Bindung veröffentlicht das
ZimaOS-App-Manifest Port `8088` auf den Host-Netzwerkschnittstellen, damit
die App-Kachel per LAN-IP öffnen kann. Wer die Web-App ausschließlich per
Tailscale zugänglich machen möchte, muss die Portfreigabe auf
`127.0.0.1:8088:80` beschränken; die ZimaOS-Dashboard-Kachel kann dann aus
anderen LAN-Geräten eventuell nicht direkt öffnen. Kein Tailscale Funnel.

## Updates

Die App verwendet derzeit `velaris-web:local` und
`velaris-cast-bridge:local`. Git Pull allein aktualisiert **keine laufenden
Container**. Neue Versionen erfordern neue lokale Images, danach ein
kontrolliertes **Recreate/Update über ZimaOS**, damit die App-Verwaltung Besitzer
der Container bleibt. Nicht gleichzeitig denselben Compose-Stack per Terminal
starten, da das zu Konflikten bei Containernamen und Ports führt.

Wenn ZimaOS die lokalen Images nicht akzeptiert, wäre die dauerhafte Lösung,
Images versioniert (z. B. GHCR) zu veröffentlichen und im Manifest zu referenzieren.
Bis dahin bleibt der bisherige, funktionierende Compose-Stack als Rückfalloption
verfügbar.

## Sicherheit und Abgrenzung

- Velaris nutzt weiterhin den bestehenden Jellyfin-Server; Jellyfin bleibt unberührt.
- Die Tailscale-Adresse kann weiter auf Port 8088 zeigen.
- Das ZimaOS-Icon kommt aus `assets/logos/NewAppIcon.png` im Repository.
- Es wird kein zusätzlicher Download- oder YouTube-Dienst installiert.
- Es wurden keine GitHub Actions gestartet.
