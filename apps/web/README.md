# Velaris Web (iPhone PWA)

**Aktuelle Quellcode-Version: 1.0.4.** Die Versionsangabe liegt im PWA-Manifest und HTML-Metadaten; der Service-Worker-Cache wird mit einer neuen Kennung aktualisiert. Die Web-Version wird beim nächsten Deployment sichtbar. Browser/iPhone-Tests bleiben erforderlich.
Eigenständige installierbare Web-App im gemeinsamen Velaris-Monorepo. Keine Apple-Developer-Mitgliedschaft oder kostenpflichtige Domain nötig.

## Schnellstart
Im Ordner `apps/web`:
```sh
python3 -m http.server 8080
```
Für **PWA-Installation** auf einem iPhone ist HTTPS erforderlich (localhost ist nur für lokale Entwicklung eine Ausnahme). Docker auf ZimaOS:
```sh
docker build -t velaris-web .
docker run -d --name velaris-web --restart unless-stopped -p 127.0.0.1:8088:80 velaris-web
```
Alternativ Docker Compose auf dem ZimaOS-Host im Ordner `apps/web`:
```sh
docker compose up -d --build
```
Die Compose-Datei bindet Port 8088 absichtlich **nur an 127.0.0.1**. Das bedeutet: direkter LAN-Zugriff funktioniert nicht; Tailscale Serve muss auf demselben Host laufen (oder der Port muss gezielt anders veröffentlicht werden).

Wenn Tailscale direkt auf dem ZimaOS-Host installiert und im Tailnet angemeldet ist, kann es die Web-App per HTTPS anbieten:
```sh
tailscale serve --bg 8088
tailscale serve status
```
Danach die von Tailscale angezeigte HTTPS-Adresse auf dem iPhone in Safari öffnen → Teilen → Zum Home-Bildschirm → Als Web-App öffnen. Keine öffentliche Freigabe per Funnel erforderlich.

**Wichtig:** Die Web-App ist damit erreichbar, aber Jellyfin braucht ebenfalls eine aus Safari erreichbare HTTPS-Adresse und korrekte CORS-Freigaben. Ohne diese funktioniert die Anmeldung nicht. Für echte iPhone-Wiedergabe ist ein Live-Test nötig.

## Jellyfin und Sicherheit
- Über `Server-Adresse` eine **vom iPhone erreichbare HTTPS-URL** des Jellyfin-Servers eingeben; `http://` wird bei HTTPS-Web-Apps als Mixed Content blockiert. Tailscale Serve für Jellyfin kann eine eigene HTTPS-Route bereitstellen.
- Der Jellyfin-Server muss Browser-CORS-Anfragen von der PWA-Origin erlauben (oder mittels sicheren Reverse Proxy unter derselben Origin erreichbar sein). Die PWA kann solche Serverbeschränkungen nicht umgehen.
- **Angemeldet bleiben:** Die Web-App speichert das Jellyfin-Access-Token pro Browser/PWA dauerhaft in `localStorage` (statt `sessionStorage`). Dadurch bleibt der Login nach Browser-Neustart erhalten und alte aktive Sitzungen werden migriert. Das Passwort wird nicht gespeichert.
- **Abmelden:** Über „Aktuelles Profil abmelden“ wird die lokal gespeicherte Sitzung dieses Profils gelöscht. Das Löschen von Website-Daten entfernt alle gespeicherten Konten. Jellyfin kann Tokens serverseitig unabhängig davon ungültig machen; dann ist eine erneute Anmeldung nötig.
- **Sicherheit:** `localStorage` ist für JavaScript derselben Origin zugänglich. Dauerhafter Login sollte daher nur auf vertrauenswürdigen, geschützten Geräten und über HTTPS genutzt werden; XSS oder ein kompromittierter Browser können Tokens auslesen. Browser- und installierte iOS-PWA-Kontexte können getrennte Speicher besitzen. Niemals Passwörter/Token im Repo hinterlegen.
- Die Web-App cached **nur die eigene statische Oberfläche**, keine Jellyfin-Videos, Tokens oder private Metadaten. Offline-Streaming ist nicht implementiert.
- Video-Wiedergabe nutzt Jellyfin HLS mit `stream.mp4` als Fallback und hängt vom Mediencodec, dem Transcoding des Servers und Safari ab. HLS-Authentifizierung über ein Query-Token sollte nur über HTTPS genutzt werden; für Produktion ist ein serverseitiger Auth-Proxy sinnvoll.
- Apple-Touch-Icon kann später als PNG hinzugefügt werden. Bis dahin wird das SVG-Favicon verwendet.

## Features
Jellyfin-Anmeldung, Profilauswahl der im Browser angemeldeten Konten, responsive Startseite mit Hero und Reihen, Suche, Filme/Serien/Anime-Filter, Favoriten, Weiterschauen, Details, Staffel-/Episodenliste und HTML5-Player.

## Status
MVP. Browser/iPhone-, Streaming-, Tailscale- und ZimaOS-Integrationstests stehen aus. Eine vollwertige, sichere öffentliche Multi-User-Plattform benötigt zusätzliche Server-/Proxy-Implementierung.

## UI Pass 8 (Web)
- Jellyfin-Titellogos mit Textfallback im Hero.
- Long-Press (Touch) / Rechtsklick (Desktop) für Poster-Schnellvorschau mit Aktionen.
- Top 10, Heute beliebt (Jellyfin-CommunityRating, keine Live-Trends), Verborgene Schätze (ungesehen, Bewertung >= 7,0) und Kurz und spannend (Filme bis 100 Minuten).
- Sammlungen mit cineastischem Hintergrund, Beschreibung und chronologisch sortierten Filmen.
- Zahnrad im Header: Startreihen anzeigen/ausblenden und sortieren, sechs Farben. Einstellungen werden pro Server und Jellyfin-Profil **lokal im Browser** gespeichert (nicht zwischen Geräten synchronisiert).
- Trailer-Autoplay bleibt deaktiviert. Echte iPhone-/Safari-/Jellyfin-Tests stehen aus.
