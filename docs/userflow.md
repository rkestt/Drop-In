# User Flow Improvements - Drop-In

## Overview

This document outlines proposed improvements to enhance the user experience in the Drop-In app. Features are organized by priority for implementation.

---

## Priority 1: High Impact

### 1. FAB (Floating Action Button) + Quick Create Lobby

**Problem:** Creating a lobby requires too many steps.

**Solution:**
- Add floating "+" button on map (bottom-right)
- Single tap opens quick-create bottom sheet
- Long-press on marker → "Create Lobby here" shortcut

**Implementation:**
- Create `components/ui/fab.tsx` component
- Add bottom sheet with sport preset, time picker, player count
- Pre-fill location from marker coordinates

---

### 2. Sport Legend / Filter

**Problem:** Users can't quickly filter courts by sport.

**Solution:**
- Create collapsible legend panel (top-left or side drawer)
- Toggle switches for each sport type
- Visual indicators (color dots) matching marker colors
- "Show all" / "Hide all" quick actions

**Implementation:**
- Create `components/map/sport-legend.tsx`
- Store filter state in React context
- Update GeoJSON filter based on selection

---

## Priority 2: Medium Impact

### 3. Cluster Badge Count

**Problem:** Clusters only show point count, not lobby count.

**Solution:**
- Modify cluster properties to aggregate lobby counts
- Update cluster label to show "5 courts · 2 lobbies"
- Different visual treatment for clusters with active lobbies

**Implementation:**
- Modify GeoJSON source aggregation
- Update cluster count label layer
- Add conditional styling for clusters with lobbies

---

### 4. Auto-Checkout Reminder

**Problem:** Users forget to check-out, causing no-show penalties.

**Solution:**
- Show notification after 90 minutes: "Still at the court?"
- Options: "Yes, still here" / "Check-out now"
- Auto-checkout after 2h with karma penalty notice

**Implementation:**
- Create `components/notifications/checkout-reminder.tsx`
- Trigger after lobby start_time + 90 minutes
- Use browser notifications API

---

### 5. Bottom Sheet - Nearby Lobbies

**Problem:** Users don't know what lobbies exist without clicking.

**Solution:**
- When zoomed in, show bottom sheet with nearby lobbies
- List up to 5 lobbies with quick join button
- Collapse to minimal indicator when scrolled

**Implementation:**
- Create `components/lobbies/nearby-lobbies.tsx`
- Calculate visible bounds, fetch nearby lobbies
- Optimistic UI with skeleton loaders

---

## Priority 3: Low Impact (Nice to Have)

### 6. Onboarding Flow

**Problem:** First-time users have no context about the app.

**Solution:**
- Welcome screen with app intro
- Sport preference selection
- Location permission with clear explanation
- Tutorial overlay on first map view

**Implementation:**
- Create `app/onboarding/page.tsx`
- Use `useRouter` with redirect logic
- Store `has_completed_onboarding` in localStorage

---

### 7. Karma Badge Display

**Problem:** Karma system is hidden, users don't feel rewarded.

**Solution:**
- Show karma badge next to user location marker
- Display level icon (🌱 Beginner, ⭐ Veteran, 🏆 Pro)
- Weekly streak indicator on profile

**Implementation:**
- Create `components/ui/karma-badge.tsx`
- Update user marker layer with karma paint
- Add level-based styling in GeoJSON properties

---

### 8. Share & Invite Flow

**Problem:** Users can't easily invite friends to a lobby.

**Solution:**
- "Copy link" button in lobby detail
- Deep link format: `dropin.app/lobby/{id}`
- Auto-generate shareable image with QR code

**Implementation:**
- Create `components/lobbies/share-lobby.tsx`
- Add API route for deep link generation
- Use Web Share API when available

---

## Technical Notes

### Component Structure

```
components/
├── ui/
│   ├── fab.tsx                 # Floating action button
│   ├── bottom-sheet.tsx        # Reusable bottom sheet
│   └── karma-badge.tsx         # Karma display
├── map/
│   ├── sport-legend.tsx        # Sport filter panel
│   └── cluster-label.tsx      # Enhanced cluster display
├── lobbies/
│   ├── nearby-lobbies.tsx      # Bottom sheet with nearby lobbies
│   └── share-lobby.tsx         # Share functionality
└── notifications/
    ├── checkout-reminder.tsx   # Auto-checkout notification
    └── lobby-notification.tsx  # Push notifications
```

### State Management

- Sport filter: React Context (`SportFilterContext`)
- Nearby lobbies: SWR or React Query with bounds-based cache
- User preferences: localStorage (no server sync needed)

### API Endpoints Needed

```
GET /api/lobbies/nearby?lat={lat}&lng={lng}&radius={m}
POST /api/lobbies/{id}/share
GET /api/checkout/reminder-status
```

---

## Implementation Order

1. `fab.tsx` + Quick Create
2. `sport-legend.tsx` + Filter
3. `nearby-lobbies.tsx` Bottom Sheet
4. `checkout-reminder.tsx`
5. `karma-badge.tsx`
6. `onboarding/page.tsx`
7. `share-lobby.tsx`

---

## Questions for Further Clarification

- Should the FAB be visible at all times or only when logged in?
- How should cluster lobby count be aggregated (sum, distinct lobbies)?
- What's the preferred style for the onboarding screens?
- Should karma badge show on all markers or only user's own?