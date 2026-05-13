# Mobile Strategy - Drop-In

## Overview

Analysis of transformation options from web app to native mobile application.

---

## Solution Comparison

| Solution | Performance | Native UX | Native APIs | Effort | Maintenance |
|----------|-------------|----------|------------|--------|-------------|
| PWA | ⚠️ Good | ⚠️ Decent | ❌ Limited | ✅ Minimal | ✅ One codebase |
| Capacitor | ✅ Great | ✅ Native | ✅ Full | ⚠️ Medium | ⚠️ Two codebases |
| Expo/RN | ✅ Best | ✅ Best | ✅ Full | ❌ High | ⚠️ Two codebases |
| Tauri | ✅ Great | ✅ Native | ⚠️ Limited | ⚠️ Medium | ⚠️ Two codebases |

---

## Recommended Solution: Expo + React Native

### Why Expo/RN is Best for Drop-In

#### 1. Native Performance
```
Web:   JavaScript → Interpreted → Browser → Render
React Native: JavaScript → Compiled → Native Bridge → Render
```
- Smoother maps (MapLibre with native bridge)
- 60fps guaranteed
- Battery efficient

#### 2. Full Native API Access
```
✅ Push Notifications (Firebase Cloud Messaging)
✅ Geofencing (you're near a court)
✅ Camera access for profile photos
✅ Bluetooth for direct connections
✅ Background location tracking
✅ Haptic feedback
```

#### 3. Superior User Experience
- Native iOS/Android navigation
- Native swipe gestures
- OS integration (share sheet, calendar)
- App icon badge for notifications

#### 4. Mature Ecosystem
```
✅ Expo: rapid development without Xcode
✅ EAS Update: OTA updates without store
✅ Expo Go: immediate testing
✅ 50k+ ready native libraries
```

---

## Transformation Plan: Web → React Native

### Phase 1: Expo Setup (Week 1)

**Goal:** Create working Expo project

```
Step 1: Create expo-app from existing web app
├── expo-router for file-based navigation
├── Port existing components
├── Reimplement CourtMap (react-native-maps)
└── Test on Expo Go

Step 2: Configure native modules
├── @react-native-mapbox/maps for maps
├── expo-notifications for push
├── expo-location for geofencing
└── expo-camera for photos
```

### Phase 2: Components Porting (Week 2-3)

**Components to port:**
```
📋 UI Components
├── Button, Badge, Input (tamagui/nativewind)
├── BottomSheet (react-native-gesture-handler)
└── Toast notifications

📍 Map Components
├── CourtMap → react-native-maps
├── Marker clustering (react-native-map-clustering)
└── User location marker

📱 Screens
├── HomePage → /app/index.tsx
├── CourtDetail → /app/courts/[id].tsx
├── LobbyPage → /app/lobbies/[id].tsx
└── Profile → /app/profile.tsx
```

### Phase 3: Native Features (Week 4)

**Native features to implement:**
```
🔔 Push Notifications
├── Firebase Cloud Messaging setup
├── Background notifications
└── Local notifications for reminders

📍 Geolocation
├── Geofencing (you're near a court)
├── Background location tracking
└── Auto check-in/out

📤 Sharing
├── Native share sheet
├── Deep links for lobbies
└── Share to social
```

### Phase 4: Testing & Store (Week 5-6)

**Deploy:**
```
iOS App Store:
├── Expo EAS Submit
├── Screenshots and metadata
└── Review ~1-3 days

Google Play Store:
├── Expo EAS Submit
├── AAB build
└── Review ~1-7 days
```

---

## Detailed Comparison

### Web PWA vs React Native

| Aspect | PWA | React Native |
|--------|-----|-------------|
| Installation | 1 browser tap | App Store |
| Update | Instant | Store review (optional) |
| Offline | Limited cache | Complete local database |
| Notifications | Basic | Complete with actions |
| Geofencing | ❌ Not available | ✅ Background monitoring |
| Camera | ❌ Limited | ✅ Full access |
| BT/WiFi | ❌ No | ✅ Direct connections |
| App Store SEO | ❌ No | ✅ Visibility |

---

## Investment Summary

| Aspect | PWA | React Native |
|--------|-----|--------------|
| Total time | 1-2 weeks | 5-6 weeks |
| Cost | $0 | $0 (Expo free tier) |
| Codebase | 1 | 2 (shared logic) |
| Performance | 80% | 100% |
| Native features | Minimal | Complete |
| Maintenance | Simple | Medium |

---

## Implementation Timeline

### Week 1: Setup
```
Day 1-2: npx create-expo-app drop-in
Day 3-4: Configure Tamagui/NativeWind
Day 5-7: Port CourtMap component
```

### Week 2-3: Core Features
```
Port all UI components
Implement navigation
Connect Supabase auth
Test real-time lobbies
```

### Week 4: Native
```
Push notifications
Geolocation
Share functionality
```

### Week 5-6: Polish + Deploy
```
Complete testing
App Store screenshots
EAS Build + Submit
```

---

## Questions to Answer Before Starting

1. **How important is user experience for you?**
   - "Good enough" → PWA
   - "Must be optimal" → React Native

2. **Which native features do you urgently need?**
   - Only notifications → Capacitor (faster)
   - Everything complete → Expo/RN

3. **Do you have React Native experience?**
   - Yes → Can proceed autonomously after setup
   - No → Expo makes everything easier

---

## Alternative: Capacitor (If You Want Faster)

If React Native is too much effort, Capacitor offers 80% of benefits with 40% of work:

```bash
# Install Capacitor
npm install @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android

# Initialize
npx cap init "Drop-In" "com.dropin.app"

# Add platforms
npx cap add ios
npx cap add android

# Build and sync
npm run build
npx cap sync
```

### Capacitor Pros
- 80% native experience
- Faster to implement
- Still uses your web code
- Can convert to RN later

### Capacitor Cons
- Web code still runs in WebView
- Performance not as good as RN
- Some native APIs still require plugins

---

## Decision Matrix

| Your Priority | Recommended Solution |
|----------------|---------------------|
| Fastest to market | PWA → Capacitor |
| Best balance | Capacitor first, RN later |
| Best long-term | Expo/RN from start |
| MVP only | PWA |
| Production app | Expo/RN |

---

## Current Project Status

### PWA Already Implemented
```
✅ manifest.json configured
✅ Service Worker (Serwist) implemented
✅ Viewport mobile-ready
✅ display: "standalone"
```

### PWA Still Missing
```
❌ App icons (192x192, 512x512)
❌ iOS favicon.png
❌ Splash screen colors
❌ Share Target configuration
❌ App Store screenshots
```

---

## Next Actions

1. **Decide on approach** (PWA/Capacitor/Expo-RN)
2. **If PWA:** Add missing icons and assets
3. **If Capacitor:** Install and configure
4. **If Expo/RN:** Create new project and start porting

---

## Resources

- [Expo Documentation](https://docs.expo.dev)
- [React Native Documentation](https://reactnative.dev)
- [Tamagui (Cross-platform UI)](https://tamagui.dev)
- [NativeWind (Tailwind for RN)](https://www.nativewind.dev)
- [EAS Build](https://docs.expo.dev/build/introduction)