# Zusammenführung: Importstand

## Übernommene Quellen

- Smartphone: [f9fc989b1bebeb37f90d3d7d2e36c5dd7728c13e](https://github.com/Homiiboy/Velaris-Smartphone-App/commit/f9fc989b1bebeb37f90d3d7d2e36c5dd7728c13e)
- TV: [880cb8c18a48c507a078fe7960c036c04b5d5e37](https://github.com/Homiiboy/Velaris-TV-App/commit/880cb8c18a48c507a078fe7960c036c04b5d5e37)

Alle 71 versionierten Quelldateien sind berücksichtigt. Quellcode, PNGs, Konfigurationen, Lockfile und ursprüngliche READMEs bleiben bytegleich; die drei GitHub-Workflows wurden an die Wurzel verschoben und für die neuen App-Verzeichnisse angepasst. Das Importmanifest ordnet jede Quelldatei ihrem Ziel zu.

## Historie und Betrieb

Dies ist ein Snapshot-Import, keine Zusammenführung der gesamten Commit-Historien. Frühere Commits, Issues, Pull Requests, Releases und Build-Artefakte bleiben in den Ursprungsrepositories. Die Ursprungsrepositories wurden nicht verändert oder archiviert.

App-IDs, Versionen und Expo/EAS-Projektzuordnung sind unverändert. Repository-Secrets, Signing-Zertifikate, Keystores und GitHub-/Expo-Einstellungen wurden nicht kopiert. Ein neues Repository erhält diese Einstellungen nicht automatisch.

## Nächste Arbeitspakete

1. Kompatibilität von Expo / React Native mit TV-Unterstützung prüfen.
2. TV-Prototyp aus gemeinsamer Basis: Anmeldung, Profilwahl, Medienreihe, Fernbedienung und Wiedergabe.
3. Auf Smartphone und echtem Google TV prüfen.
4. Jellyfin-Service, Datenmodelle, Profile, Medienlogik und Design gemeinsam nutzen; gerätespezifische Player und Navigation gezielt kapseln.
5. Alle bestehenden Funktionen übernehmen und erst nach Abnahme die bisherigen Repositories archivieren.

## Validierungsgrenzen

Die importierten Blob-Hashes werden gegen die Quellen geprüft. Die Workflows werden auf ihre neuen Arbeits-, Cache- und Artefaktpfade geprüft. Der Import bestätigt keine Laufzeitfunktion auf Geräten und ersetzt keine signierten Release-Builds.
