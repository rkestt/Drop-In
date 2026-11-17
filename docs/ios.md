# Verificare «come su iPhone»

Cosa possiamo testare sul motore di Safari, cosa l'emulazione non riproduce e come si copre il
resto. Vale per i prototipi (`docs/design/prototypes/`) e per l'app.

## Il comando

```bash
npm run verify:webkit                                  # prototipo di default
npm run verify:webkit -- --url=http://127.0.0.1:4173/onboarding.html
WEBKIT_ENGINE=docker npm run verify:webkit             # forza il container
BROWSER=chromium npm run verify:webkit                 # confronto Chromium
```

`scripts/verify/webkit-proto.sh` avvia il server statico se non c'è, prova il **WebKit locale** e
se non parte passa da solo all'**immagine Playwright** (`mcr.microsoft.com/playwright:v1.65.0-noble`),
poi spegne il server. Lo script vero è `scripts/verify/webkit-proto.mjs`: controlla overflow,
font, console e — se il prototipo espone `window.__proto` — snap, altezze, tap, drag, `100dvh` e
`prefers-reduced-motion`.

Gira nel job `quality` della CI (`.github/workflows/ci.yml`) dopo i test visual.

Per **l'app** (non i prototipi) il giro equivalente è un progetto Playwright con profilo iPhone:

```bash
npm run test:ios        # playwright test --project=iphone-webkit (iPhone 13, WebKit)
```

Oggi copre la home (overflow, nav ≥44px, eccezioni JS). Quando il foglio delle partite arriva nel
codice (#89), i check di altezza, gesto e testa che sparisce si aggiungono lì, non in un test nuovo.

## WebKit su Arch (host di sviluppo)

Playwright supporta ufficialmente solo Debian/Ubuntu: `install-deps` è apt-only e su Arch non fa
niente. Il WebKit del bundle è compilato contro `libicu*.so.74` e `libxml2.so.2`, che le distro
rolling non hanno più. Le librerie giuste esistono come pacchetti e stanno **fuori** dalla cache
di Playwright, quindi sopravvivono a `playwright install`:

```bash
sudo pacman -S --needed libxml2-legacy      # repo extra: fornisce libxml2.so.2
yay -S --needed icu74                       # AUR: ICU 74 accanto a quello di sistema
# solo se il MiniBrowser si lamenta delle voci flite:
yay -S --needed flite-voices-extra
npx playwright install webkit
```

Diagnosi: `ldd ~/.cache/ms-playwright/webkit-*/minibrowser-wpe/bin/MiniBrowser | grep 'not found'`.
Se manca qualcosa, quella riga dice cosa.

Da evitare: symlink di `libxml2.so.16` su `.so.2` e copie a mano dentro
`~/.cache/ms-playwright/*/minibrowser-wpe/sys/lib/` (funzionano, ma un `playwright install` le
cancella). Nota: `LD_LIBRARY_PATH` esterno **non** aiuta, il wrapper `minibrowser-wpe/MiniBrowser`
lo sovrascrive.

Sull'immagine ufficiale non serve niente di tutto questo: Microsoft la documenta proprio per le
distro non supportate.

## Cosa l'emulazione non riproduce

Playwright non documenta una matrice: la tabella viene da `deviceDescriptorsSource.json` e dalle
issue del progetto. Fonte per fonte in fondo.

| Aspetto | In WebKit-Playwright | Conseguenza |
|---|---|---|
| Collasso della URL bar, `dvh`/`svh` che cambiano, `visualViewport` che emette `resize` | mai: il descriptor fissa `viewport` 390×664 e non cambia | la trappola del `dvh` non si vede. Si verifica il **contratto**: altezze ricalcolate su `resize`/`ResizeObserver`, mai quotate al mount |
| `env(safe-area-inset-*)` | sempre `0` ([#43283](https://github.com/microsoft/playwright/issues/43283), chiusa «No such plans») | un test che passa qui su safe-area non ha verificato **niente** |
| Tastiera virtuale e il suo effetto su fixed/footer/scroll | non esiste | punto cieco per sheet con campi |
| Momentum, rubber-band, double-tap zoom, long-press callout, edge-swipe back, pinch | non emulati (`hasTouch` dà solo tap e touch events) | il *feel* non è testabile, la correttezza del layout sì |
| PWA: install, `display-mode: standalone`, push | non riproducibili | si prova su device |
| `inert`, pointer capture, scroll-snap **CSS** | funzionano: sono motore, non hardware | coperti bene |
| Versione del motore | WebKit patchato (WPE) su Linux, non la build di iOS | un bug visto qui può non esistere su iOS e viceversa |

**Safe-area**: l'unico posto dove si può emulare è Chromium via CDP (dai 156):

```js
const cdp = await page.context().newCDPSession(page);
await cdp.send("Emulation.setSafeAreaInsetsOverride", { insets: { top: 47, bottom: 34 } });
```

`npm run verify:webkit` lo fa già: dopo i check WebKit apre Chromium, applica `top: 47 / bottom: 34`
e verifica che il foglio si alzi di 34px e che la nav cresca. Se un componente usa
`env(safe-area-inset-*)` in un altro modo, inietta le inset come custom property con fallback
`env(...)` e verifica quelle: su WebKit il valore resta `0` e un test che ci si appoggia non ha
verificato nulla.

## iPhone reale senza iPhone

- **iOS Simulator su Linux**: no. Xcode richiede macOS su hardware Apple ([supporto Xcode](https://developer.apple.com/support/xcode),
  [licenza Xcode](https://www.apple.com/legal/sla/docs/xcode.pdf)); una VM macOS su PC è fuori licenza.
- **Device cloud**: i servizi seri chiedono un tunnel verso `localhost`.
  - **LambdaTest / TestMu AI**: free tier con 60 min/mese di live testing — sufficiente per 4-6
    passaggi manuali al mese sui gesti.
  - **BrowserStack**: gratis solo per progetti open source.
  - **Sauce Labs**: trial, non free tier.
- Un passaggio manuale su device reale resta necessario per: URL bar/`dvh`, tastiera, gesti,
  PWA installata. È la riserva scritta in [#89](https://github.com/rkestt/Drop-In/issues/89) e in
  `docs/design/stack.md` (d4).

## Fonti

- Requisiti di sistema Playwright (solo Debian/Ubuntu): `docs/src/intro-js.md`, `docs/src/docker.md`
  del repo `microsoft/playwright`.
- `install-deps` apt-only: `packages/playwright-core/src/server/registry/dependencies.ts`.
- WebKit su Arch: [microsoft/playwright#36904](https://github.com/microsoft/playwright/issues/36904).
- Pacchetti: [AUR `icu74`](https://aur.archlinux.org/packages/icu74), `libxml2-legacy` in `extra`,
  [AUR `flite-voices-extra`](https://aur.archlinux.org/packages/flite-voices-extra).
- Safe-area: [#23611](https://github.com/microsoft/playwright/issues/23611), [#43283](https://github.com/microsoft/playwright/issues/43283).
- Device descriptor e `isMobile`: `packages/isomorphic/deviceDescriptorsSource.json`, `docs/src/emulation.md`.
