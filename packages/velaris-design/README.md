# Gemeinsames Velaris-Design

`brand.json` ist die einzige Quelle für gemeinsame Farben, Navigationsnamen, Startseitenreihen, Profilgrenze und Avatar-Reihenfolge.

- **Smartphone:** `apps/mobile/src/theme.ts` importiert dieses JSON.
- **Android TV:** Gradle nimmt diesen Ordner als Android-Asset-Quelle auf; `VelarisDesign.kt` liest dieselbe Datei beim Start.
- **Avatare und Icons:** Die Originale liegen in `assets/`; `node scripts/check-unified.cjs` prüft bytegleiche Kopien.

Plattformspezifisch bleiben die Bedienung (Touch vs. D-Pad), Player, Cast und lokale Downloads. Benutzerprofile repräsentieren echte Jellyfin-Konten. Tokens bleiben gerätespezifisch gespeichert; Medienstatus synchronisiert Jellyfin.
