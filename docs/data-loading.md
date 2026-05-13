# Data Loading Optimization - Drop-In

## Current State

### How Data Loads Now

```
App starts → Page mount → useEffect → fetchData()
    ↓
[1] Fetch courts from Supabase (3.6k+ records)
[2] Fetch lobbies (status=open, 20 max)
[3] Fetch user auth
[4] Set realtime subscription for lobbies
    ↓
UI renders with data
```

### Data Fetching Code (`app/(app)/page.tsx`)

```typescript
useEffect(() => {
  const fetchData = async () => {
    // Courts query with .or() filter for sports
    const { data } = await supabase
      .from("courts")
      .select("id, name, lat, lng, address, sport, zone")
      .or("sport.ilike.*basket*,sport.eq.basketball,...")
      .limit(10000);

    // Lobbies query
    const { data: lobbiesData } = await supabase
      .from("lobbies")
      .select("*, lobby_participants(count)")
      .eq("status", "open")
      .gte("start_time", now)
      .limit(20);

    // Auth
    const { data: authData } = await supabase.auth.getUser();

    setLoading(false);
  };
  fetchData();
}, []);
```

### Problems with Current Approach

| Problem | Impact | Severity |
|---------|--------|----------|
| No cache | Loading on every visit | 🔴 High |
| No preload | Slow first render | 🔴 High |
| No bounding box filter | Loads all courts even when zoomed out | 🟡 Medium |
| Realtime is per-lobby | Could optimize with bounding box | 🟡 Medium |

---

## Optimization Plan

### Phase 1: Local Cache (Priority 1)

**Goal:** Show data immediately without waiting for network

**Implementation:**
```typescript
// Cache strategy
const CACHE_KEY = "dropin_courts";
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

function getCachedCourts() {
  const cached = localStorage.getItem(CACHE_KEY);
  if (!cached) return null;
  const { data, timestamp } = JSON.parse(cached);
  if (Date.now() - timestamp > CACHE_TTL) return null;
  return data;
}

function setCachedCourts(courts) {
  localStorage.setItem(CACHE_KEY, JSON.stringify({
    data: courts,
    timestamp: Date.now()
  }));
}
```

**Flow:**
```
App starts
    ↓
Check localStorage cache
    ↓
Cache exists + valid? → Show immediately → Fetch fresh → Update
Cache empty/expired? → Show loading → Fetch → Cache → Show
```

---

### Phase 2: Server-Side Preload (Priority 2)

**Goal:** Data ready before page renders

**Option A: Server Components (Next.js 15)**
```typescript
// app/(app)/page.server.tsx
async function getCourts() {
  const supabase = createClient();
  const { data } = await supabase
    .from("courts")
    .select("id, name, lat, lng, address, sport, zone")
    .limit(10000);
  return data;
}

export default async function Page() {
  const courts = await getCourts();
  return <HomePage initialCourts={courts} />;
}
```

**Option B: Route Handler**
```
GET /api/courts → returns courts JSON
GET /api/lobbies → returns lobbies JSON
```

**Trade-offs:**
- Option A: Better performance, harder to debug
- Option B: More flexible, easier caching

---

### Phase 3: Query Optimization (Priority 3)

**Goal:** Load only visible courts based on map viewport

**Implementation:**
```typescript
// Only fetch courts within map bounds
map.on("moveend", async () => {
  const bounds = map.getBounds();
  const { data } = await supabase
    .from("courts")
    .select("*")
    .gte("lat", bounds.getSouth())
    .lte("lat", bounds.getNorth())
    .gte("lng", bounds.getWest())
    .lte("lng", bounds.getEast());
});
```

**Benefits:**
- Faster initial load
- Less data transferred
- Better for mobile

---

### Phase 4: Skeleton Loading UI (Priority 4)

**Goal:** Better perceived performance

**Implementation:**
```typescript
// Show skeleton while loading
{loading ? (
  <div className="animate-pulse">
    <div className="h-64 bg-gray-200 rounded" />
  </div>
) : (
  <CourtMap courts={filteredCourts} />
)}
```

---

## Implementation Checklist

- [ ] Create cache utilities (`lib/cache.ts`)
- [ ] Integrate cache in `page.tsx`
- [ ] Add cache invalidation on data update
- [ ] Create Server Component for courts (optional)
- [ ] Add bounding box query (optional)
- [ ] Add skeleton loading UI

---

## Tech Stack Compatibility

| Optimization | Works with SSR? | Works with CSR? | Notes |
|--------------|-----------------|-----------------|-------|
| Local Cache | ✅ | ✅ | Universal |
| Server Components | ✅ | ❌ | Next.js only |
| Bounding Box | ✅ | ✅ | Requires map bounds |
| Skeleton UI | ✅ | ✅ | Universal |

---

## Performance Targets

| Metric | Current | Target | Improvement |
|--------|---------|--------|-------------|
| First Contentful Paint | ~2s | <500ms | 75% faster |
| Time to Interactive | ~3s | <1s | 66% faster |
| Cache Hit Rate | 0% | >80% | - |

---

## Questions to Answer Before Implementation

1. **Do you need offline support?**
   - Yes → Use Service Worker + Cache API
   - No → Just localStorage is fine

2. **How important is real-time data?**
   - Critical → Keep realtime subscription
   - Nice-to-have → Polling every 30s is acceptable

3. **Mobile or Desktop first?**
   - Mobile → Cache is more important
   - Desktop → Server preload more valuable