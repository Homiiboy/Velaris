# Velaris UI-Polish-Pass 9 – Player & Smart Features

12. Oktober 2026. Fokus: `apps/tv` (Android TV/Google TV) und `apps/mobile` (Expo/React Native). **`apps/web` nicht geändert.**

## Enthaltene Implementierungen

### Android TV

- **Next-Episode-Overlay:** Eine weitere Episode wird über die Jellyfin-`/Shows/{SeriesId}/Episodes`-Liste ermittelt. Eine per Fernbedienung wählbare Karte erscheint in den letzten 90 Sekunden eines laufenden Videos und kann die nächste Folge sofort starten. Automatische Weiterschaltung respektiert die bestehende Einstellung `auto_next`.
- **Seriendetails:** Aktion „Nächste Folge“ wählt zuerst einen begonnenen, noch nicht abgeschlossenen Eintrag; andernfalls die nächste ungesehene Episode. Die Staffel-/Folgenliste und Miniaturen bleiben vorhanden.
- **Streamingqualität:** In Einstellungen → Wiedergabe kann die maximale Bitrate zwischen 4/8/12/20 Mbit/s gewechselt werden. Die Media3-Jellyfin-Anforderung und das DeviceProfile verwenden diesen Grenzwert. Während der Wiedergabe öffnet die blaue Fernbedienungstaste die Qualitätswahl und bereitet den Stream an der bisherigen Position neu vor.
- **Track-Menü und Diagnose:** Bestehende MENU-/SETTINGS-Auswahl für Audio und Untertitel sowie INFO-Overlay, D-Pad-Suche, Segment-Skip und Wiedergabeberichte bleiben erhalten.
- **Fehlerbehandlung:** Der bisherige Retry-Dialog mit kompatiblem Fallback bleibt erhalten.

### Smartphone

- **Player-Steuerung:** Zusätzlich zu den nativen Expo-Video-Controls erscheinen 10-Sekunden-Sprungaktionen, Play/Pause, Spielzeit und Restzeit.
- **Next-Episode-Vorschau:** In den letzten 90 Sekunden werden Episodentitel, Staffelinformation, Vorschaubild und Countdown angezeigt. Auswahl führt zur nächsten Episode.
- **Streamingqualität:** Automatisch oder Bitratenlimit 4/8/12 Mbit/s, sofern der Jellyfin-Server die PlaybackInfo-Vorgabe unterstützt. Auswahl startet den Stream neu und versucht, die Wiedergabeposition zu behalten.
- **Audio & Untertitel:** Vorhandene MediaStream-Auswahl bleibt erhalten; der Wechsel versucht nun ebenfalls, die Wiedergabeposition beizubehalten.
- **IntroSkipper & Abspann:** Neue **optionale** Einstellungen für automatisches Überspringen erkannter Intro-/Rückblick- und Credits-/Outro-Segmente, standardmäßig aus. Der bestehende manuelle Überspringen-Button bleibt erhalten.
- **Fehlerbehandlung:** Bei Fehlermeldungen eine sichtbare Wiederholen-Aktion. Bereits vorhandener direkter Stream-Fallback bleibt.

## Grenzen / bekannte Nacharbeiten

- Qualitätsbegrenzungen sind Jellyfin-Serveranforderungen, keine Garantie für bestimmte Auflösungen oder Codec-Ausgaben. Direct Play kann andere Eigenschaften aufweisen.
- Die TV-Next-Episode-Suche benötigt eine verfügbare, von Jellyfin geordnete Episodenliste. Fehlt eine nächste Folge, wird keine Karte angezeigt.
- Player-Vorschaubilder, Segmenterkennung und Medieninformationen sind von Jellyfin-Metadaten abhängig.
- Smartphone-Cast- und externe Ton-/Untertitelausgabe müssen separat auf Geräten geprüft werden.
- Größere Neugestaltung des nativen Media3-Progress-Bars ist für Pass 10 bzw. nach Release zurückgestellt, um Stabilität zu priorisieren.

## Test-/Abnahmeliste

- [ ] Smartphone GitHub Actions: TypeScript und Android-Bundle grün.
- [ ] Android TV GitHub Actions: Kotlin-Build, Lint und APK grün.
- [ ] Android TV: Next-Episode-Karte in den letzten 90 Sekunden; D-Pad-Klick; Ende der letzten Staffel, Ende ohne nächste Episode.
- [ ] Android TV: Video mit 4/8/12/20 Mbit/s testen; aktiven Stream an gleicher Position neu laden.
- [ ] Android TV: Intro, Rückblick, Credits, Auto-Skip, MENU-Audio/Untertitel, INFO-Overlay, Seek und Retry testen.
- [ ] Smartphone: Play/Pause, Sprünge und Restzeit; Tonspur-/Untertitelwechsel ohne Positionsverlust.
- [ ] Smartphone: automatische Skips ein/aus; fehlerhafte/nicht verfügbare Segmentantworten; AutoNext an/aus.
- [ ] Jellyfin: Wiedergabefortschritt, Favoriten und Gesehen-Zustand nach Player-Verlassen und Profilwechsel auf beiden Geräten prüfen.
- [ ] TV: Navigation auf Peaq Google TV, nicht nur Emulator.
- [ ] Bestehende Themes (Violett/Grün/Gelb/Rot/Orange/Blau) prüfen.

**Status: Committed, CI-Läufe und Hardwaretests müssen separat bestätigt werden. TV 1.0.0 erst nach UI-Pass 10 und Release-Abnahme.**
