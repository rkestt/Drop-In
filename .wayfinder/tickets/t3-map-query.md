---
id: t3
type: grilling
hitl: true
claimed: true
blocked_by: []
---
## Question
Mappa: `page.tsx` fa `.limit(100)` su ~10k courts — mappa incompleta. Decisione: query viewport-based PostGIS (bbox/st_dwithin) vs cluster vs filtro? Performance target? Zoom minimo?

## Resolution
**Decisione: Viewport PostGIS bbox/st_dwithin**
Query viewport-based PostGIS: caricare solo i courts nel bounding box visibile. Performance target: risposta <300ms a zoom città.
