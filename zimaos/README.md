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

## Parallele Installation ohne Portkonflikte

Die bestehende Velaris-Web-Installation auf Port `8088` bleibt **unangetastet**.
Die ZimaOS-App nutzt Port `8089` und den eigenen Container
`velaris-zimaos-web`. Die separate Cast Bridge wird **nicht noch einmal**
gestartet: Die bestehende Bridge auf Host-Port `8766` wird über das
vorhandene Nginx-Proxy-Setup mitverwendet. Deshalb sollte die alte Bridge für
Cast-Funktionen weiterlaufen.

1. Das Repository aktualisieren:
   ```bash
   cd ~/AppData/Velaris-v2
   git pull origin main
   ```
2. In ZimaOS **App Store → Install a customized app → Import** öffnen und
   `zimaos/velaris-compose.yaml` importieren.
3. Namen, Icon und Port `8089` prüfen und installieren. Die alten Container
   **nicht** stoppen.
4. Über `http://<ZIMAOS-LAN-IP>:8089` testen. Im Terminal:
   ```bash
   curl -s http://127.0.0.1:8089/ | grep application-version
   sudo docker ps --format 'table {{.Names}}\t{{.Ports}}'
   ```
   Erwartet: Versionskennung 2.0.0 und ein neuer Container
   `velaris-zimaos-web`.

**Hinweis:** Der neue Port `8089` ist im LAN erreichbar, solange Firewall
und ZimaOS-Netzwerk das erlauben. Die bisherige Tailscale-HTTPS-Adresse
zeigt weiter auf `8088`; sie wird **nicht automatisch** auf `8089`
umgestellt. Für iPhone-/HTTPS-Tests muss der neue Port separat über HTTPS
zugänglich gemacht werden. Die alte Web-App bleibt als Rückfalloption.

Wenn ZimaOS lokal erstellte Images nicht unterstützt und versucht,
`velaris-web:local` aus einer Registry zu laden, bricht die Installation ab.
Dann müssen wir das Image in einer erreichbaren Registry versioniert
veröffentlichen oder einen kompatiblen Importweg verwenden.

## Updates

Die ZimaOS-App verwendet derzeit `velaris-web:local` und nutzt die vorhandene
Cast Bridge auf dem Host. Git Pull allein aktualisiert **keine laufenden
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
