# Piano Test Completo - Drop-In

Questo documento descrive tutti i test necessari per coprire il 100% del progetto.

---

## Stato Attuale

| Tipo | Test | Status |
|---|---|---|
| Unit (Vitest) | 100 | ✅ Passati |
| E2E (Playwright) | 7 | ✅ Passati |
| **Totale** | **107** | ✅ |

---

## Test Mancanti per Copertura Completa

### Fase 1: Componenti Semplici (~30 test)

#### 1.1 BottomSheet (`components/ui/bottom-sheet.tsx`)

```typescript
// File: components/ui/__tests__/bottom-sheet.test.tsx

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BottomSheet } from '../bottom-sheet'

describe('BottomSheet', () => {
  it('renders children when open', () => {
    render(<BottomSheet open>Content</BottomSheet>)
    expect(screen.getByText('Content')).toBeInTheDocument()
  })

  it('does not render when closed', () => {
    render(<BottomSheet open={false}>Content</BottomSheet>)
    expect(screen.queryByText('Content')).not.toBeInTheDocument()
  })

  it('calls onClose when clicking close button', async () => {
    const onClose = vi.fn()
    render(<BottomSheet open onClose={onClose}>Content</BottomSheet>)
    await userEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(onClose).toHaveBeenCalled()
  })

  it('has animation classes', () => {
    render(<BottomSheet open>Content</BottomSheet>)
    const sheet = screen.getByText('Content').closest('div')
    expect(sheet).toHaveClass('transition-')
  })
})
```

#### 1.2 Input (`components/ui/input.tsx`)

```typescript
// File: components/ui/__tests__/input.test.tsx

import { render, screen } from '@testing-library/react'
import { Input } from '../input'

describe('Input', () => {
  it('renders with placeholder', () => {
    render(<Input placeholder="Enter text" />)
    expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument()
  })

  it('accepts value', () => {
    render(<Input value="test" />)
    expect(screen.getByDisplayValue('test')).toBeInTheDocument()
  })

  it('calls onChange', async () => {
    const onChange = vi.fn()
    render(<Input onChange={onChange} />)
    // ... test onChange
  })

  it('shows error state', () => {
    render(<Input error>Invalid</Input>)
    expect(screen.getByText('Invalid')).toBeInTheDocument()
  })
})
```

#### 1.3 QuickCreate/FAB (`components/ui/fab.tsx`, `components/ui/quick-create.tsx`)

```typescript
// File: components/ui/__tests__/fab.test.tsx

import { render, screen } from '@testing-library/react'
import { QuickCreateFAB } from '../fab'

describe('QuickCreateFAB', () => {
  it('renders FAB button', () => {
    render(<QuickCreateFAB />)
    expect(screen.getByRole('button')).toBeVisible()
  })

  it('opens sheet on click', async () => {
    // ... test click → sheet opens
  })

  it('shows plus icon', () => {
    render(<QuickCreateFAB />)
    expect(screen.getByText(/plus/i)).toBeInTheDocument()
  })
})
```

#### 1.4 RecentCourtsSheet (`components/ui/recent-courts-sheet.tsx`)

```typescript
// File: components/ui/__tests__/recent-courts-sheet.test.tsx

import { render, screen } from '@testing-library/react'
import { RecentCourtsSheet } from '../recent-courts-sheet'

describe('RecentCourtsSheet', () => {
  it('shows empty state when no recent courts', () => {
    render(<RecentCourtsSheet recentCourts={[]} />)
    expect(screen.getByText(/nessun campo recente/i)).toBeInTheDocument()
  })

  it('lists recent courts', () => {
    const courts = [{ id: '1', name: 'Court A' }]
    render(<RecentCourtsSheet recentCourts={courts} />)
    expect(screen.getByText('Court A')).toBeInTheDocument()
  })

  it('calls onSelect when clicking court', async () => {
    // ... test selection
  })
})
```

---

### Fase 2: Hooks Avanzati (~20 test)

#### 2.1 useCourtCache (`lib/hooks/useCourtCache.ts`)

```typescript
// File: lib/__tests__/hooks/useCourtCache.test.ts

import { renderHook, waitFor } from '@testing-library/react'
import { useCourtCache } from '../../hooks/useCourtCache'

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => mockSupabase,
}))

vi.mock('@/lib/cache/courts', () => ({
  getCachedCourts: vi.fn(),
  setCachedCourts: vi.fn(),
  isCacheStale: vi.fn(),
}))

describe('useCourtCache', () => {
  it('returns cached courts', () => {
    // test cache hit
  })

  it('fetches from API when cache stale', () => {
    // test cache miss → API call
  })

  it('sets cache on fetch success', () => {
    // test cache write
  })

  it('handles API error', () => {
    // test error handling
  })

  it('returns loading state', () => {
    // test loading
  })
})
```

#### 2.2 useRecentCourts (`lib/hooks/useRecentCourts.ts`)

```typescript
// File: lib/__tests__/hooks/useRecentCourts.test.ts

describe('useRecentCourts', () => {
  it('returns empty array initially', () => {})

  it('adds court to recent', () => {})

  it('removes court from recent', () => {})

  it('limits to 5 recent courts', () => {})

  it('moves existing court to front', () => {})
})
```

#### 2.3 useUserProfile (`lib/hooks/useUserProfile.ts`)

```typescript
// File: lib/__tests__/hooks/useUserProfile.test.ts

describe('useUserProfile', () => {
  it('fetches profile on mount', () => {})

  it('returns cached profile', () => {})

  it('updates profile', () => {})

  it('clears profile on logout', () => {})

  it('handles errors', () => {})
})
```

---

### Fase 3: Test API Routes (~15 test)

#### 3.1 Configurazione MSW (Mock Service Worker)

```bash
npm install -D msw
npx msw init ./public --save
```

#### 3.2 Test per /api/courts

```typescript
// File: app/api/courts/__tests__/route.test.ts

import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'

const server = setupServer(
  http.get('/rest/v1/courts', () => {
    return HttpResponse.json([
      { id: '1', name: 'Court A', lat: 1, lng: 1 }
    ])
  })
)

describe('GET /api/courts', () => {
  beforeAll(() => server.listen())
  afterAll(() => server.close())

  it('returns courts data', async () => {
    const res = await fetch('/api/courts')
    const json = await res.json()
    expect(json.data).toHaveLength(1)
  })

  it('includes cache headers', () => {
    // test cache headers
  })
})
```

---

### Fase 4: Componenti Complessi (~25 test)

#### 4.1 CourtMap - Test Rendering Base (con MapLibre mock)

```typescript
// File: components/map/__tests__/court-map.test.tsx

// Per testare CourtMap senza MapLibre reale, si usa un mock:
vi.mock('maplibre-gl', () => ({
  Map: vi.fn().mockImplementation(() => ({
    addControl: vi.fn(),
    on: vi.fn(),
    remove: vi.fn(),
  })),
  Marker: vi.fn().mockImplementation(() => ({
    setLngLat: vi.fn().add,
    setPopup: vi.fn(),
    addTo: vi.fn(),
    remove: vi.fn(),
  })),
}))

describe('CourtMap', () => {
  it('renders map container', () => {
    render(<CourtMap courts={[]} />)
    expect(screen.getByTestId('map-container')).toBeInTheDocument()
  })

  it('renders markers for each court', () => {
    const courts = [{ id: '1', lat: 45, lng: 9 }]
    render(<CourtMap courts={courts} />)
    // verifica marker vengono creati
  })

  it('clusters markers when zoomed out', () => {
    // test clustering
  })

  it('calls onCourtClick when marker clicked', async () => {
    const onCourtClick = vi.fn()
    render(<CourtMap courts={[]} onCourtClick={onCourtClick} />)
    // click marker → callback
  })
})
```

#### 4.2 LobbyList (con Supabase mock)

```typescript
// File: components/lobby/__tests__/lobby-list.test.tsx

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockResolvedValue({ data: [], error: null }),
      on: vi.fn().mockReturnValue({ subscribe: vi.fn() }),
    }),
    auth: { getUser: vi.fn() },
    removeChannel: vi.fn(),
  }),
}))

describe('LobbyList', () => {
  it('shows loading skeleton', () => {
    // test loading state
  })

  it('shows empty state when no lobbies', () => {
    // test empty state
  })

  it('renders lobbies when data available', () => {
    // test with mock data
  })

  it('subscribes to realtime updates', () => {
    // test subscription
  })
})
```

#### 4.3 CreateLobbySheet

```typescript
// File: components/lobby/__tests__/create-lobby-sheet.test.tsx

describe('CreateLobbySheet', () => {
  it('validates required fields', async () => {
    // submit vuoto → errori
  })

  it('validates date is in future', () => {})

  it('calls createLobby on submit', async () => {})

  it('resets form on close', () => {})
})
```

#### 4.4 CheckIn Components

```typescript
// File: components/check-in/__tests__/check-in-button.test.tsx

describe('CheckInButton', () => {
  it('checks geolocation permission', () => {})

  it('shows loading while checking location', () => {})

  it('calls check-in API on success', () => {})

  it('shows error on location denied', () => {})

  it('shows error when too far from court', () => {})
})
```

---

### Fase 5: E2E Avanzati (~15 test)

#### 5.1 Aggiungere a e2e/login.spec.ts

```typescript
import { test, expect } from '@playwright/test'

test.describe('Login Flow', () => {
  test('shows login modal', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /profilo/i }).click()
    await expect(page.getByText(/accedi/i)).toBeVisible()
  })

  test('can login with email', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /profilo/i }).click()
    await page.getByPlaceholderText('Email').fill('test@test.com')
    await page.getByPlaceholderText('Password').fill('password')
    await page.getByRole('button', { name: /accedi/i }).click()
    // verifica login
  })

  test('shows error on invalid credentials', async ({ page }) => {
    // test error handling
  })
})
```

#### 5.2 Aggiungere a e2e/lobby.spec.ts

```typescript
test.describe('Lobby Flow', () => {
  test('can create lobby', async ({ page }) => {
    // login → go to court → create lobby
  })

  test('can join lobby', async ({ page }) => {
    // login → find lobby → join
  })

  test('sees own lobbies in dashboard', async ({ page }) => {
    // verify dashboard shows user lobbies
  })
})
```

#### 5.3 Aggiungere a e2e/checkin.spec.ts

```typescript
test.describe('Check-in Flow', () => {
  test('can check in to lobby', async ({ page }) => {
    // login → joined lobby → check in
  })

  test('fails when too far from court', async ({ page }) => {
    // test distance validation
  })
})
```

---

## Riepilogo File da Creare

```
lib/__tests__/hooks/
├── useCourtCache.test.ts      # 6-8 test
├── useRecentCourts.test.ts    # 4-6 test
└── useUserProfile.test.ts     # 6-8 test

components/ui/__tests__/
├── bottom-sheet.test.tsx     # 4-6 test
├── input.test.tsx            # 4-6 test
├── fab.test.tsx              # 3-4 test
└── recent-courts-sheet.test.tsx # 4 test

components/lobby/__tests__/
├── lobby-card.test.tsx       # 6-8 test
└── lobby-list.test.tsx       # 4-6 test

components/check-in/__tests__/
└── check-in-button.test.tsx  # 5-6 test

app/api/courts/__tests__/
└── route.test.ts             # 5-6 test

app/api/favorites/__tests__/
└── route.test.ts             # 8-10 test

e2e/
├── login.spec.ts             # 3 test
├── lobby.spec.ts             # 3 test
└── checkin.spec.ts           # 2 test
```

---

## Comandi per Eseguire Test

```bash
# Unit test
npm run test:run

# E2E test (richiede Supabase locale)
npm run e2e

# Unit test con UI
npm run test:ui

# E2E con UI
npm run e2e:ui
```

---

## Note Importanti

1. **Supabase deve essere in esecuzione** per i test E2E:
   ```bash
   npx supabase start
   ```

2. **MSW richiesto** per test API routes:
   ```bash
   npm install -D msw
   ```

3. **某些 componenti (CourtMap) sono difficili da testare in isolamento** - considerare di coprirli principalmente con E2E.

---

## Priorità Consigliata

Se non hai tempo per tutto, ecco l'ordine consigliato:

1. **Alta priorità** (test core per MVP):
   - useCourtCache
   - LobbyCard
   - CheckInButton
   - Login E2E

2. **Media priorità**:
   - useUserProfile
   - CreateLobbySheet
   - LobbyList

3. **Bassa priorità** (difficile da testare):
   - CourtMap (coprire con E2E)
   - API routes (già coperti da E2E)

---

*Documento generato il 2026-05-15*
*Progetto: Drop-In Web App*
*Totale test previsti: ~107 esistenti + ~105 nuovi = ~212 test*