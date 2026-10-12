# Velaris Web – UI-Pass 9 (Player & Smart Features)

Stand: 12. Oktober 2026. Umsetzung ausschließlich in `apps/web`.

## Funktionen
- HTML5-/Safari-Player mit nativen Videocontrols, Play/Pause, +10/-10 Sekunden und Laufzeit/Restzeit.
- Bitraten-Auswahl Auto / 4 / 8 / 12 / 20 Mbit/s; bei Wechsel versucht der Player die Position zu behalten.
- Wiedergabeeinstellungen je Jellyfin-Benutzer und Server im lokalen Browser: Auto-Next (aus), Intro-Auto-Skip (aus), Credits-Auto-Skip (aus).
- Nächste Folge: aus Jellyfin-Episodenliste ermittelt, Vorschau in den letzten 90 Sekunden. Automatischer Start nur bei aktivierter Einstellung.
- MediaSegments für manuellen oder optional automatischen Skip von Intro/Rückblick/Abspann. Ohne Segmente keine Skip-Aktion.
- HLS-/MP4-Fallback, Retry-Button und Statusmeldung.
- Vorhandene native Browser-Audio-/Untertitelcontrols bleiben vorhanden, ihre Verfügbarkeit hängt vom Safari/Jellyfin-HLS-Stream ab.

## Technische Grenzen und Prüfung
Qualitätsangaben sind Serveranforderungen, keine Garantie für Codec/Auflösung. MediaSegments benötigen entsprechende Jellyfin-Server-/Plugin-Unterstützung. Auto-Next und Segmentfunktionen müssen mit echten Inhalten geprüft werden. Track-Umschaltung ist nicht in allen Browsern oder Streams verfügbar. Ein DRM-/Offline-Download-/Casting-Player ist nicht enthalten.

Die GitHub Web CI prüft Syntax und PWA-Dateien; ein echter iPhone-15-Plus-/Safari-/Jellyfin-Test ist für die Freigabe weiterhin erforderlich.
