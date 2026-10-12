# Velaris UI-Polish-Pass 7 – TV & Smartphone

Stand: 12. Oktober 2026. In diesem Pass wurden ausschließlich die nativen Apps unter `apps/tv` und `apps/mobile` bearbeitet. **Die Web-App wurde nicht verändert.**

## Themes: Akzent statt komplettes Layout

Beide Apps bieten in **Einstellungen → Darstellung** folgende Akzentfarben:

| Theme | Farbe |
| --- | --- |
| Violett (Standard) | `#7C5CFC` |
| Grün | `#35C97A` |
| Gelb | `#F3C94E` |
| Rot | `#EE525C` |
| Orange | `#FA923C` |
| Blau | `#399FFF` |

Der Hintergrund `#08080D`, vorhandene dunkle Cinematic-Schattierungen und grundsätzliche Schriftfarben bleiben bestehen. Die gewählte Akzentfarbe gilt für Hauptnavigation, Teile des Brandings, Fokusindikatoren sowie ausgewählte Player-/Detail-Akzente.

**Speicherung**: TV Android SharedPreferences (`ui_accent`), Smartphone Expo SecureStore (`velaris.theme.accent.v1`). Geräte haben bewusst unabhängige Darstellungseinstellungen; Jellyfin synchronisiert diese nicht.

## Funktionsstand 1–16

| Nr. | Bereich | Implementierung / Status |
| --- | --- | --- |
| 1 | Hero 2.0 | TV: per Fernbedienung wählbare Hero-Indikatoren, bestehende Crossfades, automatische Wechsel abschaltbar. Smartphone: bestehende Indikatoren/Crossfade, Auto-Play-Toggle. **Video-Trailer nicht implementiert**. |
| 2 | Poster-Vorschau | TV: nach kurzem Fokusdelay eingeblendete Metadaten-Ribbons. Smartphone: Long-Press-Infodialog mit Details-Aktion. |
| 3 | Empfehlungen | Zusätzliche „Für deinen Filmabend“- und „Noch nicht angesehen“-Reihen aus Jellyfin-Metadaten; bestehende persönliche Empfehlungen bleiben. |
| 4 | Weiterschauen | Geräte-lokales Ausblenden per Long Press und Wiederherstellen in den Einstellungen. **Jellyfin-Fortschritt bleibt erhalten**. |
| 5 | Cast & Crew | Detailseite aus Jellyfin-Personendaten, anklickbare Suche per Jellyfin-`Person`-Filter. |
| 6 | Qualitäts-Badges | Nur auf Grundlage verfügbarer MediaStreams: 4K/Full HD/HD, HDR/Dolby Vision, 5.1, Untertitel. Wenn Metadaten fehlen, erscheint kein Badge. |
| 7 | Anzeige-Einstellungen | Theme, automatische Heroes, Animationen, Poster-Vorschau. **Postergrößen-Regler noch nicht integriert**. |
| 8 | Suche 2.0 | Mobile: Art, ungesehene Titel, Jahr, zuletzt gesucht. TV: Art, ungesehen, zuletzt gesucht per Fernbedienung. |
| 9 | Staffel/Episoden | Vorhandene Episodencards mit Thumbnail, Restzeit und Fortschritt weiterverwendet; kein vollständiges Redesign in diesem Pass. |
| 10 | Demnächst | Reihe erscheint ausschließlich bei Jellyfin-Titeln mit PremiereDate in der Zukunft. |
| 11 | Zufallsfilm | TV: zufälliger Film startet direkt. Smartphone: zufälliger Film öffnet Details. |
| 12 | Aktionsfeedback | TV: bestehende Toasts für Favoriten; Smartphone: bestehende optimistische Herz-/Profil-Rückmeldung. Keine neue globale Toast-Komponente. |
| 13 | Untertitel | TV: Größenwahl Klein/Standard/Groß in Darstellung, Übergabe an Media3 SubtitleView. **Smartphone: native Playercontrols erlauben nicht dieselbe zuverlässige Änderung; offen**. |
| 14 | TV Zurück-Navigation | Bestehende Backstack-/Poster-Fokus-Rückkehr aus Pass 6 bleibt erhalten; exaktes Scroll-Restore nicht neu implementiert. |
| 15 | TV Player-Info | Bestehende Diagnostikanzeige über INFO-Taste erhalten. |
| 16 | Detail-Transitionen | Bestehende Fade-Übergänge erhalten, respektieren auf Mobile die Animationseinstellung. |

## Wichtig für Tests

Die Commits auf `main` sind **keine Bestätigung eines grünen Builds**. Im Chat konnten die GitHub-Push-Actions bisher nicht zuverlässig über die GitHub-Connector-Abfrage ausgelesen werden. Reale CI-Prüfungen und Hardwaretests sind zwingend.

```bash
cd apps/mobile
npm ci
npm run typecheck
```

```bash
cd apps/tv
gradle :app:lintDebug :app:assembleDebug
```

### Manuelle Regression

1. Theme auf beiden Geräten wählen, zurück zur Startseite, neu starten. Farbe bleibt, dunkler Hintergrund bleibt unverändert.
2. Fernbedienung: Hero-Indikatoren fokussieren/wechseln; Filmreihen navigieren ohne Bildbeschnitt.
3. Weiterschauen: einen Titel ausblenden, Fortschritt in Jellyfin prüfen, ausgeblendete Titel wiederherstellen.
4. Details: Cast, Qualität, Weiterführende Suche, Staffel-/Episodenlisten und Vorschaubilder.
5. Player: Media3-Untertitelgröße, Seek/Resume, IntroSkipper, Tonspur und Auto-Next.
6. Smartphone: Hero anhalten, lange auf Poster drücken, Suche filtern, zuletzt gesuchte Begriffe auswählen.
7. Suche, Kategorien und „Demnächst“ bei leeren, fehlerhaften und nicht erreichbaren Jellyfin-Daten prüfen.
8. Kontrast für Gelb/Orange/Grün und Skalierung auf kleinerem Fernseher prüfen.

**Freigabestatus: Implementierte Funktionsbausteine brauchen noch grüne CI-Läufe und Gerätetests. Die oben explizit offenen Features sind nicht Teil dieser Umsetzung.**
