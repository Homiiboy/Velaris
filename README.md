# Velaris

<p align="center">
  <img src="assets/logos/NewAppIcon.png" alt="Velaris Logo" width="160" />
  &nbsp;&nbsp;&nbsp;
  <img src="assets/banners/VelarisBannerTV.png" alt="Velaris TV Banner" width="320" />
</p>

Gemeinsames Repository für Velaris auf iOS, Android und Android TV / Google TV.

## Stand der Zusammenführung

Die vollständigen Quellstände beider Apps wurden übernommen. Aktuell sind es zwei separat baubare Anwendungen in einem Repository. Gemeinsame Anwendungslogik und eine einheitliche, geräteangepasste Oberfläche sind der nächste Schritt; dieser Import stellt noch keine gemeinsame Runtime her.

| Bereich | Pfad | Technik |
| --- | --- | --- |
| Smartphone (iOS / Android) | [apps/mobile](apps/mobile) | React Native / Expo / TypeScript |
| TV (Android TV / Google TV) | [apps/tv](apps/tv) | Kotlin / Media3 |
| Importnachweis und nächste Schritte | [docs/MIGRATION.md](docs/MIGRATION.md) | Quellstände, Umfang und Einschränkungen |

## Smartphone starten

Node.js 22.13+ verwenden. Alle Expo- und EAS-Befehle aus `apps/mobile` ausführen:

```bash
cd apps/mobile
npm ci
npm run start
```

Typprüfung: `npm run typecheck`.
Android-Test-APK über EAS: `npx eas-cli build --platform android --profile preview`.
Die vorhandene Expo-Projektzuordnung bleibt bestehen; dafür ist Zugriff auf das bestehende Expo-Projekt erforderlich.

## TV bauen

In Android Studio den Ordner `apps/tv` öffnen oder mit JDK 17 und Gradle 9.6.0:

```bash
cd apps/tv
gradle :app:lintDebug :app:assembleDebug
```

APK: `apps/tv/app/build/outputs/apk/debug/app-debug.apk`.

## GitHub Actions

Die aktiven Workflows liegen zentral in `.github/workflows`:

- **Android TV CI**: TV-Lint und Debug-APK bei TV-Änderungen oder manuell.
- **Build unsigned iOS IPA**: manueller Build; die IPA ist unsigniert und muss vor einer Geräteinstallation signiert werden.
- **Generate package-lock**: manuelle Aktualisierung des Smartphone-Lockfiles.

Arbeitsverzeichnisse, npm-Cache und Artefaktpfade sind an die neue Struktur angepasst. Ein lokaler Android-Smartphone-Workflow war im Ursprungsrepository nicht vorhanden; dafür bestehen die EAS-Buildprofile.

## App-Identität

- Smartphone Android / iOS: `at.velaris.app`
- Android TV: `com.novarion.velaristv`
- Bestehende Versionen, Icons, Avatare und EAS-Projekt-ID bleiben erhalten.
- Signierschlüssel, GitHub-Secrets, Expo-Zugriffsrechte und frühere Build-Artefakte sind keine Quelldateien und werden durch diesen Import nicht übertragen. Die bestehende Signierung ist für Updates vorhandener Installationen erforderlich.

Die README-Dateien in den App-Ordnern dokumentieren den übernommenen Stand; ihre früheren Fertigmeldungen sind keine erneute Gerätevalidierung.
