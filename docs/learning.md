# Data Loading Strategies - Learning Notes

## Overview

This document explains the differences between various data loading strategies and when to use each one.

---

## Strategy Comparison

### 1. Client-Side Rendering (CSR)

**What it is:**
Traditional React approach where data is fetched in the browser after the page loads.

```typescript
useEffect(() => {
  const data = await fetch('/api/data');
  setState(data);
}, []);
```

| Pros | Cons |
|------|------|
| Simple to implement | Slow first render (FOUC) |
| Works with any backend | Loading state visible |
| Good for user-specific data | SEO issues |

**When to use:**
- User-specific dashboards
- Data behind authentication
- Real-time updates

---

### 2. Server-Side Rendering (SSR)

**What it is:**
Data is fetched on the server before sending HTML to the browser.

```typescript
// Next.js Page
export async function getServerSideProps() {
  const data = await fetchData();
  return { props: { data } };
}
```

| Pros | Cons |
|------|------|
| Fast first paint | Server costs |
| SEO friendly | Complex caching |
| No loading flash | Debug harder |

**When to use:**
- Content-heavy pages
- SEO important
- Public data

---

### 3. Static Site Generation (SSG)

**What it is:**
Pages are pre-built at build time. Data doesn't change until next deploy.

```typescript
export async function getStaticProps() {
  const data = await fetchData();
  return { props: { data }, revalidate: 60 };
}
```

| Pros | Cons |
|------|------|
| Extremely fast | Not real-time |
| Cheap hosting | Build time grows |
| CDN ready | Stale data possible |

**When to use:**
- Documentation
- Blog posts
- Marketing pages

---

### 4. Incremental Static Regeneration (ISR)

**What it is:**
Static pages that regenerate in the background when data changes.

```typescript
export async function getStaticProps() {
  const data = await fetchData();
  return { props: { data }, revalidate: 60 }; // Revalidate every 60s
}
```

| Pros | Cons |
|------|------|
| Always fresh | Complex setup |
| Fast pages | Cache invalidation issues |
| Scale well | Debug harder |

**When to use:**
- E-commerce product pages
- News articles
- User-generated content

---

### 5. Local Cache (Browser)

**What it is:**
Store data in browser storage (localStorage, IndexedDB) for fast access.

```typescript
// Cache strategy
const cache = {
  get: (key) => JSON.parse(localStorage.getItem(key)),
  set: (key, value, ttl) => {
    localStorage.setItem(key, JSON.stringify({
      data: value,
      timestamp: Date.now(),
      ttl
    }));
  },
  isValid: (cached, ttl) => Date.now() - cached.timestamp < ttl
};
```

| Pros | Cons |
|------|------|
| Instant display | Storage limits |
| Works offline | Security concerns |
| Reduce server load | Stale data risk |

**When to use:**
- Static reference data
- User preferences
- Offline support

---

### 6. Bounding Box Query

**What it is:**
Only fetch data within the visible viewport.

```typescript
map.on('moveend', async () => {
  const bounds = map.getBounds();
  const data = await supabase
    .from('courts')
    .select('*')
    .gte('lat', bounds.getSouth())
    .lte('lat', bounds.getNorth())
    .gte('lng', bounds.getWest())
    .lte('lng', bounds.getEast());
});
```

| Pros | Cons |
|------|------|
| Less data transfer | Pan/zoom lag |
| Faster queries | Edge cases |
| Mobile friendly | Complexity |

**When to use:**
- Map-based apps
- Location services
- Infinite scroll

---

### 7. Realtime Subscriptions

**What it is:**
WebSocket connection for instant data updates.

```typescript
supabase
  .channel('table')
  .on('postgres_changes', { event: '*', table: 'items' }, handleChange)
  .subscribe();
```

| Pros | Cons |
|------|------|
| Instant updates | Server resources |
| Real-time UX | Connection issues |
| Efficient | Complex debugging |

**When to use:**
- Chat apps
- Live tracking
- Collaborative tools

---

## Strategy Matrix

| Strategy | First Paint | SEO | Real-time | Complexity |
|----------|-------------|-----|-----------|-------------|
| CSR | ❌ Slow | ❌ Poor | ✅ | ✅ Simple |
| SSR | ✅ Fast | ✅ Good | ❌ | ⚠️ Medium |
| SSG | ✅ Fast | ✅ Great | ❌ | ✅ Simple |
| ISR | ✅ Fast | ✅ Great | ⚠️ | ⚠️ Medium |
| Local Cache | ✅ Instant | N/A | ❌ | ✅ Simple |
| Bounding Box | ✅ Fast | N/A | ⚠️ | ⚠️ Medium |
| Realtime | ✅ Fast | N/A | ✅ | ⚠️ Medium |

---

## Drop-In App Specifics

### Current State
```
App starts → useEffect → fetchData() → Supabase query
```

**Problems identified:**
1. No cache → Loading on every visit
2. No preload → Slow first render
3. No bounding box → Loads all 3.6k courts

### Recommended Approach for Drop-In

```
┌─────────────────────────────────────────────────────────────┐
│                     USER VISITS APP                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     CHECK LOCAL CACHE                       │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              │                               │
         Cache Valid                      Cache Invalid/Expired
              │                               │
              ▼                               ▼
┌─────────────────────────┐      ┌─────────────────────────┐
│   SHOW CACHED DATA       │      │   SHOW LOADING STATE     │
│   (Instant display)      │      │   (Skeleton UI)         │
└─────────────────────────┘      └─────────────────────────┘
              │                               │
              ▼                               ▼
┌─────────────────────────────────────────────────────────────┐
│                  FETCH FRESH DATA                          │
│              (Async, in background)                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 UPDATE UI + CACHE                          │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Learnings

### When to Use What

| Scenario | Best Strategy |
|-----------|----------------|
| Public blog | SSG + ISR |
| User dashboard | CSR + Local Cache |
| Map app | Bounding Box + Cache |
| Chat app | Realtime + Local Cache |
| E-commerce | SSR + ISR + Cache |

### Performance Tips

1. **Show something fast** - Use cache or skeleton
2. **Update in background** - Don't block UI
3. **Be defensive** - Handle offline/errors
4. **Measure first** - Profile before optimizing

### Common Pitfalls

| Pitfall | Solution |
|---------|----------|
| Loading flash | Skeleton or cache |
| Stale data | TTL + invalidation |
| Too many queries | Batch + debounce |
| Memory leaks | Cleanup subscriptions |

---

## Further Reading

- [Next.js Data Fetching](https://nextjs.org/docs/app/building-your-application/data-fetching)
- [Supabase Realtime](https://supabase.com/docs/guides/realtime)
- [MDN Cache API](https://developer.mozilla.org/en-US/docs/Web/API/Cache)
- [Web Vitals](https://web.dev/vitals/)