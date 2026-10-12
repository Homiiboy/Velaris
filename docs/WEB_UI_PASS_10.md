# Velaris Web – UI Pass 10: Release Polish

Stand: 12. Oktober 2026. Pass 10 überträgt die Stabilitätsziele von TV/Smartphone auf die Web-PWA, ohne das Hauptlayout, Jellyfin-Login, Profilkonzept oder die Designfarben zu verändern.

## Verbesserungen

- Navigation und asynchrone Jellyfin-Antworten: Bibliotheks-, Detail- und Sammlungsanfragen dürfen nach einem Seiten- oder Profilwechsel nicht mehr die sichtbare Seite überschreiben.
- Player-Lebenszyklus: Beim Schließen Video pausieren, Medienquelle freigeben, offene Timer stoppen und nur zum gültigen Benutzerprofil zurückkehren.
- Next-Episode-Handoff: die bekannte nächste Folge direkt starten statt auf einen zusätzlichen Jellyfin-Detailrequest zu warten.
- Player-Metadaten: verspätete Events und Wiedergabeaktionen nach Player-Ende ignorieren.
- Verbesserte Touch-Ziele auf dem Smartphone; PWA-Cache-Version aktualisiert.
- Erweiterte CI-Regressionchecks für diese Änderungen.

## Freigabestatus

Dies ist ein **Release-Polish des Quellcodes**, kein fertig abgenommener Web-v1.0.0-Release. Keine produktive ZimaOS-Installation, iPhone-Safari-Validierung, Jellyfin-Integration, Live-Transcoding- oder MediaSegments-Tests durchgeführt. Eine Freigabe sollte nach echtem Gerätetest erfolgen.

## Abnahmecheckliste

- [ ] PWA in Safari auf iPhone installieren und nach Update neu öffnen
- [ ] Profile wechseln während langsamer Jellyfin-Bibliotheksanforderung
- [ ] Film-/Seriendetails schnell öffnen und schließen
- [ ] Sammlungen bei langsamer Verbindung und bei HTTP-Fehlern prüfen
- [ ] Mehrfach Player öffnen/schließen, Audiowiedergabe muss enden
- [ ] Next Episode manuell und automatisch testen (auch Serienende)
- [ ] Bitrate ändern, Wiedergabe an gleicher Position fortsetzen
- [ ] Intro/Credits-Segmente mit und ohne Plugin testen
- [ ] Alle sechs Designfarben, Navigation und Safe Areas prüfen
- [ ] Web CI grün, anschließend Live-Deployment unter HTTPS/Tailscale prüfen
