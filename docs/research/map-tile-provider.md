# Fonti di tile per la mappa: licenze, costi, offline

Research notes, 2026-11-06. Stack: `maplibre-gl`, Serwist (`app/sw.ts`), Next 15 App Router,
`output: standalone`. Fonti consultate lo stesso giorno, salvo diversa indicazione.

## TL;DR

1. **Dati OSM ≠ server di tile.** I dati sono ODbL (uso commerciale libero, una mappa renderizzata
   è un "Produced Work": niente share-alike). Il server `tile.openstreetmap.org` è infrastruttura
   donata: policy che vieta il prefetch/offline e avverte che l'accesso ai servizi commerciali può
   essere revocato. La cache attuale (1200 tile, `CacheFirst`) era **non conforme**.
2. **OpenFreeMap** è la scelta per oggi: vettoriale, stili Light/Dark, nessuna chiave, uso
   commerciale dichiarato "Yes" nella FAQ del sito, offline consentito (≤3.000 tile o 50 MB per
   download, ≤4 richieste parallele), licenza del progetto MIT.
3. **Il requisito "unique User-Agent" vale per le app native, non per il browser.** L'autore
   identifica le app web dal **Referer** e limita per-referer (~100M richieste/24h). Citazioni sotto.
4. **Maptoolkit.org** è tecnicamente ottimo (dark completo, Cloudflare, dati settimanali) ma vieta
   gli "offline tile sets": incompatibile con il caching persistente nel service worker.
5. **Self-host** (Planetiler + PMTiles + Cloudflare R2) è la via d'uscita a costo ~0, ma 6–10 ore di
   setup e nessun update incrementale: non ora.
6. Nel codice: `lib/map/provider.ts` centralizza style URL, attribuzione, host e limiti di cache;
   `NEXT_PUBLIC_MAP_PROVIDER=osm` torna al raster OSM.

---

## 1. Perché `tile.openstreetmap.org` va lasciato

Policy OSMF per i tile (`operations.osmfoundation.org/policies/tiles`, rivista 2026-10-29):

- i dati sono liberi, **i server no**: "Our tile servers are not: they are funded by donations …".
- uso pesante → blocco senza preavviso; i servizi commerciali "should be especially aware that
  access may be withdrawn at any point".
- caching client **richiesto** (almeno 7 giorni o secondo gli header), ma **prefetch e offline
  vietati**: "'Download city/country for offline use' … rely on prefetch/bulk downloading and are
  therefore prohibited".
- serving richiede User-Agent applicativo (i default delle librerie vengono bloccati) e Referer per
  il web.

La nostra cache (`CacheFirst` su `tile.openstreetmap.org`, 1200 voci, 7 giorni) ricade nel divieto:
cachava tile non ancora viste dall'utente, senza limite di area.

## 2. OpenFreeMap — scelta corrente

Operatore: Hyperknot Software Kft. (Ujlengyel, HU), Zsolt Ero. Il servizio nasce dalla sua
infrastruttura per **MapHub** (prodotto commerciale, sua fonte di reddito): è la ragione per cui è
improbabile che chiuda, ma non è uno SLA.

Dichiarazioni ufficiali (`openfreemap.org`, consultato 2026-11-06):

- "Is commercial usage allowed? **Yes.**" (FAQ del sito; i ToS non ne parlano)
- "Can my app download areas for offline use? **Yes**, as long as each download is at most **3,000
  tiles or 50 MB**, uses at most **4 parallel requests**, and sends a unique User-Agent identifying
  your app."
- Attribuzione: `OpenFreeMap © OpenMapTiles Data from OpenStreetMap`; con MapLibre "they are
  automatically added". La parte OpenFreeMap è gradita ma non obbligatoria.
- Licenza del progetto: **MIT** (LICENSE.md). Dati ODbL, stili derivati da OpenMapTiles.
- SLA: nessuno; "may discontinue it at any time without notice"; piano Pro futuro solo se c'è
  interesse.
- ToS: legge ungherese, arbitrato a Budapest, Cloudflare come CDN.

**User-Agent vs Referer** (fonte: `hyperknot.com/blog/openfreemap-survived-100000-requests`,
l'incidente da 3 miliardi di richieste/24h, 215 TB, 100k req/s causato da Wplace.live):

- "I need to implement bandwidth limiting **by referer**";
- "every referer will be limited to a very high number, like **100 million requests per 24 hours**";
- "For **native apps**, I'll probably ask them to add a **custom header** identifying their app".

Conclusione operativa: un browser è identificato dal Referer del nostro dominio; il "unique
User-Agent" dei ToS riguarda i client che controllano l'HTTP client. Non serve chiedere permessi.

Numeri del primo mese (`hyperknot.com/blog/first-month-of-openfreemap`): 777M richieste/mese,
~300 req/s, 120 TB/mese su 2 server, costo ~$175/mese, sponsor $105/mese; il Contabo da €4,5/mese è
citato come sufficiente per il progetto. Il nostro consumo (9–25 tile per vista, cache a 600 voci) è
irrilevante.

Stili: `tiles.openfreemap.org/styles/{liberty,bright,positron,dark,fiord}` (tutti HTTP 200 il
2026-11-06; `dark` = 47 layer, glyphs `/fonts/{fontstack}/{range}.pbf`, sprite
`/sprites/ofm_f384/ofm`). Il README degli stili dichiara **Dark e Fiord non ancora completi**: da
valutare a occhio prima di dichiararli definitivi.

## 3. Maptoolkit.org (Toursprung GmbH, AT) — il concorrente serio, ma niente offline

ToS community, 2026-07-01; sito `maptoolkit.org` (non `maptoolkit.com`, che è un'altra azienda con
API a pagamento via RapidAPI).

- Gratis se: non-commerciale, OSS non-commerciale, oppure **small commercial** con fatturato
  consolidato < 1M € **e** < 10 FTE (oltre: Enterprise).
- §5 consente la cache "in the ordinary course" e "transient browser or CDN caches".
- §7(b) vieta "download, scrape, mirror, copy or otherwise extract tiles … in bulk, or **generate
  offline tile sets or archives**" → il nostro service worker persistente ricadrebbe qui.
- §7(c) vieta di rivendere/white-labelare il servizio o usarlo come infrastruttura di un'altra
  offerta SaaS; l'uso in un prodotto end-user è consentito.
- Rate limit (ToS §9): 10 req/s sustained / 50 burst non registrato; 100/500 registrato (il
  marketing dichiara 120/200 e 600/1000 totali). Superamento → 429/throttle.
- Attribuzione: **logo immagine ≥24px** + riga `© Maptoolkit © Openstreetmap` cliccabile in basso a
  destra, `compact: false`; il control di MapLibre da solo non basta (pacchetti npm
  `@maptoolkit/maplibre-gl-logo` / `@maptoolkit/maplibre-logo-control`).
- 7 stili incl. **Dark completo**, ma **proprietari**: vietato self-hostare o puntare gli stili su
  altri provider. Nessuno SLA, cessazione con 90 giorni di preavviso.
- CDN Cloudflare, dati OSM ricostruiti ogni domenica.

## 4. Altre opzioni (per il piano B)

| Provider | Free commerciale | Offline/caching | Note |
|---|---|---|---|
| **Geoapify** (KEPTAGO, CY) | sì, 3.000 crediti/giorno (~12k tile, tile = 0,25 credito) | caching/storage dichiarati consentiti | chiave, soft cap, paid da $59/mese, SLA 99,5% solo paid |
| **Thunderforest** (Gravitystorm, UK) | sì, 150k req/mese | caching in-browser/on-device consentito; bulk/offline solo Small Business (~$255/mese) | chiave; superamento → email + throttle |
| **Protomaps hosted** | **no** (commerciale = sponsorizzazione, tier SaaS ~$2k/mese) | — | il software e gli stili sono aperti e self-hostabili |
| **MapTiler Cloud** | **no** (free 5k sessioni/100k API = non commerciale) | cache personale temporanea | Flex $30/mese, spending limit disponibile |
| **Stadia Maps** | **no** (free 200k crediti non commerciale) | cache ≤7 giorni/100 MB | Starter $20/mese |
| **Jawg** | **no** (25k view non commerciale) | non dichiarato | commerciale da €250/mese |
| **Mapbox** | sì (50k map loads) | offline vietato | dati proprietari, $5/1k loads dopo |

Trappola ricorrente: "free 100k richieste" di MapTiler/Stadia/Jawg è **solo non commerciale**.

## 5. Self-host (via d'uscita, non punto di partenza)

- Dati: Geofabrik `italy/centro` ~368 MB `.osm.pbf` (aggiornato giornalmente); Lazio non esiste come
  sotto-estratto, si ritaglia con `osmium extract` sul bbox di Roma.
- Build: **Planetiler** (Apache-2.0) → PMTiles con schema OpenMapTiles; RAM ~1,5× input, disco 5–10×;
  Italia intera 2,1 GB → stima 20–40 min su 8 core. Aggiornamento: **nessun incrementale**, rebuild
  completo (mensile è sufficiente per dei campi da basket).
- Serving: PMTiles su **Cloudflare R2** (free tier 10 GB, 1M Class A, 10M Class B, egress gratis);
  CORS obbligatorio con `Range`/`If-Match` esposti, altrimenti MapLibre non carica.
- Stili: **Protomaps basemaps** (BSD/CC0) hanno light + `dark`; gli stili Stamen/CARTO richiedono
  attribuzione e alcune varianti sono CC BY-NC.
- Offline: PMTiles è **un file servito via Range** → il service worker non può cachare tile
  singole; o si spedisce il file, o l'offline della basemap non si fa.
- Costo: ~€0–5/mese; effort 6–10 ore.

## 6. Conseguenze nel nostro codice

Config centralizzata in `lib/map/provider.ts`:

- `MAP_PROVIDER` (`openfreemap` default, `osm` con `NEXT_PUBLIC_MAP_PROVIDER=osm`);
- `MAP_STYLE_URL.light` = `.../styles/liberty`, `.dark` = `.../styles/dark`;
- `MAP_ATTRIBUTION` per provider; `MAP_TILE_HOSTS`; `MAP_MAX_TILE_CACHE_ENTRIES` (600 OpenFreeMap /
  1200 OSM, conservativo rispetto al limite di 3.000).

`components/map/court-map.tsx`: stile dal provider, tema letto da `documentElement.dataset.theme` e
seguito con `MutationObserver` → `setStyle()` (non ricrea la mappa; i marker sono `maplibre.Marker`
DOM e sopravvivono).

`app/sw.ts`: matcher sul host del provider, cache versionata `map-tiles-<provider>-v1`, pulizia
della vecchia `map-tiles` su `activate`. Nessun prefetch.

## 7. Aperto / da decidere

- **Qualità visiva dello stile Dark di OpenFreeMap**: verificare a schermo prima di dichiararlo
  definitivo (README lo dice incompleto).
- **Verifica in produzione**: Serwist è attivo solo con un build di produzione, quindi la cache e la
  pulizia legacy vanno provate con `npm run build && npm start`, non in dev.
- **Se serve offline "vero"** (aree scaricate): OpenFreeMap entro 3.000 tile/50 MB, oppure self-host.
- **Se l'app supera i limiti o serve un contratto**: Geoapify (termini espliciti) o Maptoolkit
  (accettando l'attribuzione con logo) — in entrambi i casi cambiare provider è un file.
- Migrazione a Maptoolkit/Geoapify: sostituire i tre valori in `provider.ts` + le regole di cache in
  `sw.ts`. Nient'altro.

## Fonti

- OSMF tile policy — `operations.osmfoundation.org/policies/tiles` (2026-10-29)
- ODbL / Produced Work — OSMF FAQ, `osmfoundation.org/wiki/Licence`
- OpenFreeMap — `openfreemap.org` (FAQ, ToS 2026-10-14, licenza), `openfreemap.org/tos/`
- `hyperknot.com/blog/first-month-of-openfreemap` (2024)
- `hyperknot.com/blog/openfreemap-survived-100000-requests` (incidente, referer/native header)
- Maptoolkit — `www.maptoolkit.org/` (licensee ToS 2026-07-01), `docs.maptoolkit.org`
- Geoapify — `geoapify.com/pricing`, `geoapify.com/map-tiles`
- Thunderforest — `thunderforest.com/pricing`, termini 2026-11-03
- Protomaps — `protomaps.com/api`, `docs.protomaps.com/pmtiles`
- MapTiler — `maptiler.com/cloud/pricing` (Flex $30/mese)
- Stadia — `stadiamaps.com/terms-of-service`
- Geofabrik — `download.geofabrik.de/europe/italy.html`
- Cloudflare R2 — `developers.cloudflare.com/r2/pricing`
