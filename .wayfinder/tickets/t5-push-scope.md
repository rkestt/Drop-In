---
id: t5
type: grilling
hitl: true
claimed: true
blocked_by: []
---
## Question
Push notifications stub end-to-end: client `push-provider.tsx` no-op, DB trigger esistono ma delivery manca (serve Edge Function + VAPID keys). Decisione: implementare ora (richiede account/VAPID, HITL setup) o deferire e disattivare UI?

## Resolution
**Decisione: Deferire + disattivare UI**
Push deferito: rimuovere/nascondere UI push, trigger DB lasciati dormienti. Implementazione futura con Edge Function + VAPID.
