# Velaris Smartphone App

<p align="center">
  <img src="assets/NewAppIcon.png" alt="Velaris App Icon" width="180" />
</p>

Native Velaris client for iOS and Android, powered by Jellyfin.

**Aktuelle Quellcode-Version: 1.0.0** (`package.json` und Expo `app.json`; Android `versionCode` 8). Da EAS die Buildnummern remote verwaltet, beim nächsten Cloud-Build die effektive Versions-/Buildnummer prüfen. Die Veröffentlichung bzw. Gerätetests sind davon unabhängig.

## Status

### Phase 1 — Jellyfin foundation ✅
Server validation, Jellyfin login, secure session persistence, library access and artwork.

### Phase 2 — Velaris experience ✅
- Home with Continue Watching and Recently Added
- Movies and Series tabs
- Server-side search
- Media detail pages
- Series seasons and episode lists
- Profile/server information and logout
- Reusable media cards/rows and dark Velaris navigation
- Detail Play entry point prepared for Phase 3

### Phase 3 — Playback ✅
- Native iOS/Android video player with fullscreen and Picture in Picture support
- Jellyfin PlaybackInfo negotiation
- Direct Play / Direct Stream / server transcoding URL support
- Resume from Jellyfin playback position
- Playback start, progress and stopped reporting back to Jellyfin
- Audio and subtitle stream selection
- Detail pages launch directly into the player

Note: codec/container behavior still needs validation against the real Jellyfin server and physical iPhone/Android devices before release.

### Phase 4 — Casting ✅
- Native Google Cast / Chromecast device picker
- Google TV and TVs with Google Cast receiver support
- Jellyfin stream URL is loaded directly by the Cast receiver; the phone remains the controller
- Cast resume position and playback progress reporting to Jellyfin
- Native iOS AirPlay route picker via expo-video
- AirPlay external playback status
- Native build configuration for Cast, local-network discovery and Picture in Picture
- EAS preview/development profiles prepared for Android APK and iOS device builds

Important: Google Cast requires a custom native build and does not work in Expo Go. Chromecast/AirPlay behavior must now be validated on the physical devices and the real Jellyfin server.

## Stack

React Native, Expo SDK 57, Expo Router, TypeScript and Expo SecureStore.

## Run

Requirements: Node.js 22.13+.

```bash
npm install
npx expo start
```

Enter a Jellyfin URL reachable from the phone. For LAN testing use the Jellyfin server's LAN address rather than localhost. Production use should use HTTPS.


### Phase 5 — Device builds 🚧

Build profiles are prepared for both physical platforms:

- Android direct-install test build: `eas build --platform android --profile preview` → APK
- iPhone direct-install test build: `eas build --platform ios --profile ios-device` → ad hoc signed IPA for registered devices
- iPhone TestFlight build: `eas build --platform ios --profile production --auto-submit`

The iOS device/TestFlight build requires an Apple Developer account and Apple signing credentials. EAS also requires an Expo account/project association before the cloud build can be started.
