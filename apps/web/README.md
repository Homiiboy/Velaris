# Velaris Web (iPhone PWA)
Eigenständige installierbare Web-App im gemeinsamen Velaris-Monorepo. Keine Apple-Developer-Mitgliedschaft oder kostenpflichtige Domain nötig.

## Schnellstart
Im Ordner `apps/web`:
```sh
python3 -m http.server 8080
```
Für **PWA-Installation** auf einem iPhone ist HTTPS erforderlich (localhost ist nur für lokale Entwicklung eine Ausnahme). Docker auf ZimaOS:
```sh
docker build -t velaris-web ./apps/web
docker run -d --name velaris-web --restart unless-stopped -p 8088:80 velaris-web
```
Tailscale Serve kann den Port 8088 im privaten Tailnet per HTTPS bereitstellen. Danach in Safari die HTTPS-Adresse öffnen → Teilen → Zum Home-Bildschirm → Als Web-App öffnen.

## Jellyfin und Sicherheit
- Über `Server-Adresse` eine **vom iPhone erreichbare HTTPS-URL** des Jellyfin-Servers eingeben; `http://` wird bei HTTPS-Web-Apps als Mixed Content blockiert. Tailscale Serve für Jellyfin kann eine eigene HTTPS-Route bereitstellen.
- Der Jellyfin-Server muss Browser-CORS-Anfragen von der PWA-Origin erlauben (oder mittels sicheren Reverse Proxy unter derselben Origin erreichbar sein). Die PWA kann solche Serverbeschränkungen nicht umgehen.
- Zugangsdaten werden nicht gespeichert. Die Jellyfin-Sitzung bleibt nur in `sessionStorage` der jeweiligen Browser-Session; nicht dauerhaft. Niemals Passwörter/Token im Repo hinterlegen.
- Die Web-App cached **nur die eigene statische Oberfläche**, keine Jellyfin-Videos, Tokens oder private Metadaten. Offline-Streaming ist nicht implementiert.
- Video-Wiedergabe nutzt Jellyfin HLS mit `stream.mp4` als Fallback und hängt vom Mediencodec, dem Transcoding des Servers und Safari ab. HLS-Authentifizierung über ein Query-Token sollte nur über HTTPS genutzt werden; für Produktion ist ein serverseitiger Auth-Proxy sinnvoll.
- Apple-Touch-Icon kann später als PNG hinzugefügt werden. Bis dahin wird das SVG-Favicon verwendet.

## Features
Jellyfin-Anmeldung, Profilauswahl der im Browser angemeldeten Konten, responsive Startseite mit Hero und Reihen, Suche, Filme/Serien/Anime-Filter, Favoriten, Weiterschauen, Details, Staffel-/Episodenliste und HTML5-Player.

## Status
MVP. Browser/iPhone-, Streaming-, Tailscale- und ZimaOS-Integrationstests stehen aus. Eine vollwertige, sichere öffentliche Multi-User-Plattform benötigt zusätzliche Server-/Proxy-Implementierung.
