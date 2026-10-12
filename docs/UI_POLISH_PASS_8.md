# Velaris UI-Polish-Pass 8 – Cinematic Streaming Experience

Stand: 12. Oktober 2026. **Änderungen ausschließlich an `apps/tv` und `apps/mobile`.** Die Web-App wurde nicht bearbeitet.

## Umgesetzte Änderungen

| Bereich | Android TV | Smartphone |
| --- | --- | --- |
| Hero 3.0 | Bestehender animierter Hero mit manuell anwählbaren, farbigen Indikatoren und Jellyfin-Logo-Fallback beibehalten | Offizielle Titellogos via Jellyfin-`Images/Logo`, sofern `ImageTags.Logo` existiert; Rückfall auf Text bei fehlenden/beschädigten Logos |
| Poster-Vorschau | Long-Press-/OK-Halten-Dialog: Medieninfo, Abspielen, Details, Meine Liste; für Sammlungen Details | Long-Press-Dialog: Details, Abspielen, Meine Liste; Meta-Informationen |
| Top 10 | Rangnummern deutlich größer, hinter Poster platziert, Poster vollständig sichtbar und Fokusrahmen weiterhin nutzbar | Rangnummern mit gewählter Akzentfarbe, vorhandene Posterspalten beibehalten |
| Neue Entdeckungsreihen | Heute beliebt, Verborgene Schätze, Kurz und spannend | Gleiche drei Reihen |
| Kollektionen | Cinematic Backdrop/Gradient mit Titel, Übersicht und Anzahl; Filme bleiben nach Erscheinungsdatum sortiert | Cinematic Backdrop und Beschreibung mit Fall-back auf Poster |
| Designfarben | Fokusrahmen/Rankings und vorhandene Brand-Akzente greifen weiter auf die gewählte Farbe zu | Top-10-Nummern, Weiterschauen-Fortschritt und Titel-Akzente greifen auf die gewählte Farbe zu |
| Startseite anpassen | Einstellungen → Startseite anpassen: Ein-/Ausblenden und Reihenfolge per D-Pad, pro Jellyfin-Benutzer gespeichert | Einstellungen → Startseite anpassen: Reihen ein-/ausblenden und per Pfeiltasten sortieren, pro Jellyfin-Profil lokal gespeichert |

### Kriterien für die neuen Reihen

- **Heute beliebt**: In Jellyfin nach `CommunityRating` sortierte Titel mit Bewertung. Dies sind **keine Live-Trenddaten**.
- **Verborgene Schätze**: nicht als gesehen markierte Titel mit Jellyfin-Bewertung mindestens 7,0.
- **Kurz und spannend**: Filme mit bekannter Laufzeit von höchstens 100 Minuten.

Bei leeren Ergebnismengen werden die Reihen ausgeblendet. Die Grundlage bleibt die eigene Jellyfin-Mediathek.

### Speicherung

TV: Android SharedPreferences, benutzerbezogene Schlüssel `home_row_order_<userId>`, `hidden_home_rows_<userId>`. Mobile: Expo SecureStore, Server-ID und Benutzer-ID im Schlüssel.

### Absichtlich nicht automatisch aktiviert

**Trailer-Autoplay** bleibt offen. Jellyfin garantiert kein einheitliches Trailer-Material und der TV-Hero soll keine Wiedergabe- oder Performance-Probleme verursachen. Erst nach Quellen-/Gerätetests sollten Vorschauvideos zugeschaltet werden. Ein vollständiges animiertes Expanding-Poster statt des stabilen Quick-Action-Dialogs ist ebenfalls noch nicht implementiert.

## Validierung – vor Release erforderlich

Die Änderungen sind auf `main` committed. **Grüne TV-/Smartphone-Builds und echte Gerätetests wurden über die verfügbare Commit-Statusabfrage noch nicht bestätigt.**

- GitHub Actions: TV `assembleDebug` / Lint und Smartphone `npm run typecheck` plus EAS/Bundle prüfen.
- TV: Hero-Indikatoren mit D-Pad, Fokusrahmen Top 10 ohne Abschneiden, Schnellvorschauen mit Fernbedienung.
- Beide: Startseiten-Sortierung und Sichtbarkeit nach Neustart und Profilwechsel.
- Beide: fehlende Logos, fehlende Bewertungen, leere Sammlungen und fehlende Metadaten testen.
- Beide: neue Entdeckungsreihen, Kollektionen, Farbthemes (Grün/Gelb/Rot/Orange/Blau/Violett) prüfen.
- Playback-Regression: Jellyfin Resume, IntroSkipper, Tonspuren, Untertitel, Auto-Next, Favoriten.
- Android TV: lange Titel, 1080p und 4K, langsame Serverantworten, ältere Google-TV-Hardware.

**Release 1.0.0 ist weiterhin erst nach Pass 10 sowie erfolgreich getesteter TV-APK vorgesehen.**
