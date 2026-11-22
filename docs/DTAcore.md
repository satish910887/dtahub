# DTAcore

DTAhub's own small framework (`public/js/dta-core.js`). Original code, no third-party dependency, about 300 lines.
Loaded first on every page (the build injects it). Pure modules also run in Node: `node scripts/core-test.mjs`.

| Module | What it gives you |
| --- | --- |
| `DTAcore.str` | `esc`, `slug` (Hindi safe), `truncate`, `pad`, `isBlank`, `graphemes` |
| `DTAcore.num` | `parse` (blank or junk is `NaN`, never 0), `fmtIN` (12,34,567.89), `inr`, `compact` (L, Cr), `bytes`, `pct`, `round`, `clamp` |
| `DTAcore.store` | safe localStorage with memory fallback: `get`, `put`, `del`, `json`, `putJson`, `list`, `push`. `DTAcore.store(backend)` makes an isolated store |
| `DTAcore.events` / `bus` | tiny emitter: `on`, `off`, `once`, `emit` (one bad handler cannot break the rest) |
| `DTAcore.i18n` | `lang`, `set`, `toggle`, `L(en, hi)`, `pick({en, hi})` |
| `DTAcore.hash` | shareable state in the URL hash: `parse`, `stringify`, `read`, `write` |
| `DTAcore.validate` | `number(v, {min, max, int, required})` returns `{ok, value, error:{en, hi}}`, plus `email`, `url`, `hexColor` |
| `DTAcore.dom` | `$`, `$$`, `h(tag, attrs, kids)`, `on`, `delegate`, `debounce`, `throttle`, `ready` |
| `DTAcore.files` | `baseName`, `extOf`, `sizeOf`, `safeName`, `saveBlob`, `saveText`, `readBuffer`, `readText`, `loadImage`, `validate`, `reasonText` |
| `DTAcore.img` | `fit(w, h, max)`, `render(im, w, h, type, q)` |
| `DTAcore.ui` | `toast`, `copy` |

The old globals (`$`, `L`, `fmt`, `toast`, `copyText`, `sizeOf`, `saveBlob`, `baseName`, `extOf`, `renderImg`, `DTAstore`) are
kept as aliases of these functions so every tool script keeps working. New tool code should call `DTAcore.*` directly.

Other original engines in the repo: `kruti-engine.js` (Kruti Dev and Unicode), `assistant-engine.js` (on-device assistant),
`zip.js` (ZIP writer), `pdfw.js` (image to PDF writer), `imgfx.js` (image effects), `build.mjs` (static site generator).

## DTAqr (own QR engine)

`public/js/dta-qr.js`: ISO 18004 encoder, versions 1 to 40, levels L/M/Q/H, numeric, alphanumeric and byte (UTF-8) modes, all 8 masks.
`DTAqr.create(text, {ec, mode, mask, minVersion, maxVersion})` returns `{size, version, mask, mode, isDark(r, c), matrix(), toSvg(opts)}`.
Tests: `node scripts/qr-test.mjs` compares 240 matrices bit for bit with an independent implementation kept in `scripts/fixtures/` (test only,
not shipped), and real QR decoders were used to scan the output. It replaced the third-party qrcode.js.
