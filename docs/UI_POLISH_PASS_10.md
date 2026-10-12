# Velaris UI-Polish-Pass 10 – Release Polish

Stand: 12.10.2026. Änderungen nur in `apps/tv`, `apps/mobile`, `docs`. **`apps/web` wurde nicht verändert.**

## Versionierung

| Anwendung | Stand |
| --- | --- |
| TV Android / Google TV | `versionName 1.0.0`, `versionCode 8` |
| Smartphone (iOS / Android) | Eigene Versionsnummer unverändert |
| Paketname TV | `com.novarion.velaristv` unverändert |

TV-`versionCode` wurde von 7 auf **8** erhöht, sodass die Versionsnummer eine höhere Update-Sequenz als 0.7.0 besitzt. In der Jellyfin-Client-Kennung und auf der TV-Einstellungsseite wird 1.0.0 angezeigt.

## Umsetzung

1. **Player-Ressourcen:** Media3 ExoPlayer beim Schließen der Activity zuverlässig freigeben und Referenzen zum PlayerView lösen.
2. **Nächste Episode:** Ein weiterer, potenziell langsamer NextUp-Netzwerkaufruf blockiert nicht mehr den Start der Folgewiedergabe. Die Folge wird unmittelbar geladen; die Vorschau für die jeweils folgende Episode kommt danach aus den Jellyfin-Serienmetadaten.
3. **Navigation:** Zurück-Callback mit `try/finally` abgesichert, begrenzter Backstack (maximal 40 Einträge), vorhandene D-Pad-Navigation und Header beibehalten.
4. **Smartphone-Netzwerk:** Sammlungsübersicht bei HTTP-/Verbindungsfehlern mit sichtbarer Retry-Aktion; aufgelöste Requests aktualisieren nach Verlassen der Ansicht nicht mehr den Zustand. Such-/Bibliotheksabrufe ignorieren ebenfalls veraltete Antworten nach einem Bereichswechsel.
5. **Regression bewusst klein gehalten:** Keine Änderung an Jellyfin-Authentifizierung, Anmeldedaten, vorhandenen Profilen, Theme-Persistenz oder dem Hauptlayout. Smartphone-Version nicht mit TV-Version gekoppelt.

## Unbedingt vor Freigabe auf echtem Peaq Google TV testen

- [ ] TV GitHub Actions: Android-Lint und Debug-APK grün.
- [ ] Smartphone GitHub Actions: TypeScript / Expo-Bundle grün.
- [ ] TV: Bestehende Installation aktualisieren. APK muss mit **derselben Signatur** wie die bereits installierte App signiert sein; ein anders signierter Debug-Build kann `INSTALL_FAILED_UPDATE_INCOMPATIBLE` verursachen. **Keine Nutzerdaten löschen**, bevor eine Sicherung / bewusste Entscheidung vorliegt.
- [ ] Nach Update: Serveradresse, angemeldete Jellyfin-Profile, Avatare, Theme-Farbe und Startseiten-Reihenfolge erhalten.
- [ ] Alle Navigationselemente und Dialoge per D-Pad; Fokus oben/links und bei Top-10-Reihe.
- [ ] Film abspielen, Seek, Tonspuren und Untertitel, Qualität wechseln, Player mehrfach öffnen/schließen, Home mit langsamer Verbindung.
- [ ] Serienfolgen: Fortsetzen, Next-Episode-Karte, Autoplay an/aus und Ende einer Staffel/Serie.
- [ ] IntroSkipper, Rückblick und Credits mit manuellem/automatischem Überspringen.
- [ ] Abbruch der Netzwerkverbindung / Wiederherstellung: keine Abstürze, verständliche Fehler, erneutes Laden.
- [ ] Nach dem Schauen: Weiterschauen / Gesehen-Status in Jellyfin sowie auf zweitem Gerät kontrollieren.
- [ ] Auf schwächerem Google TV: länger navigieren, Hintergrundwechsel, RAM-/Bildcache-Verhalten prüfen.
- [ ] App-Icon, TV-Banner, Screenshot-Material und Lesbarkeit aller sechs Akzentfarben kontrollieren.

## Release-Vorgehen

**Wichtig:** `versionName 1.0.0` ist jetzt gesetzt, aber noch kein vollständig abgenommener Release. Das ist absichtlich getrennt.

1. Grüne CI prüfen und TV-APK herunterladen.
2. Peaq-TV-Testinstallation und komplette Regression oben durchführen.
3. Bei grünem Test: signierte Release-APK oder AAB mit vorhandenen Schlüsseln erstellen; Prüfsumme dokumentieren.
4. Danach erst den GitHub-Tag `tv-v1.0.0` und die Release Notes erstellen und die APK veröffentlichen.

**Nicht automatisch durchgeführt:** Release-Signierung, echter Peaq-Gerätetest, GitHub-Tag oder veröffentlichte Binary. Der Quellcode wurde aktualisiert, ohne an Signing-Secrets zu rühren.
