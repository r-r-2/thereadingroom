# The Reading Room — agents guide

A first-person walkable 3D room containing a bookshelf, built as a single
self-contained HTML file using Three.js. No build step, no framework, no
bundler. Three.js and lil-gui load from unpkg via an import map.

## Running it

Open `reading-room-v8.html` directly in a browser. No server required for
local use — all assets are procedurally generated or loaded from a CDN via the
import map. A server (e.g. `python3 -m http.server`) is only needed if you hit
CORS restrictions from the CDN in strict mode.

## Script layout

Everything lives in one `<script type="module">`. Sections in order:

1. **Book data** — `BOOKS` array. title, author, spine/text colour, thickness,
   height, note, and either `fin` (date string) or `reading` (0–100 percent).
2. **Scene** — `THREE.Scene`, camera (eye at 1.62 m), renderer, ACES tone
   mapping, fog.
3. **Lights** — ambient, key, fill, shelfWash, candleLight, playerLight.
4. **Room shell** — floor with procedural plank texture, ceiling, four walls,
   a rug.
5. **Bookcase frame** — back panel, sides, top, toe board, shelf boards at
   y = 0.42 / 0.90 / 1.38 / 1.86.
6. **Book meshes** — `makeSpineTexture`, `makeCoverTexture`, `placeBooks()`.
   The `interactables` array is declared here, before `placeBooks()` runs.
7. **Post-processing** — `EffectComposer` with bloom, vignette, output pass.
8. **Design harness** — `SETTINGS` object and lil-gui panel.
9. **Decor** — shelf props: succulents, candles, flat book stacks, framed
   prints, vase, candleLight.
10. **Turntable** — credenza, plinth, platter, record, spindle, tonearm.
    Tonearm hit targets added to `interactables`.
11. **Music** — `Music` IIFE wrapping the Web Audio graph (pads, plucks,
    delay, vinyl hiss).
12. **Controls** — `PointerLockControls`, keyboard map, velocity/collision.
13. **Raycast interaction** — book pull-out animation, detail panel, record
    toggle.
14. **Animation loop** — movement, turntable rotation, arm travel, book
    animation, `composer.render()`.

See `ARCHITECTURE.md` for the how and why of each section.

## Constraints

- **No realtime shadows.** Performance trap at browser scale. Bake into
  textures if shadows are ever needed.
- **No mobile.** Pointer Lock is unsupported on iOS Safari; there is no WASD
  on a phone. The plan is a flat 2D shelf as the default everywhere, with a
  link into this room shown only when `navigator.permissions` / the Pointer
  Lock API reports availability. Not yet implemented.
- **Single file** unless explicitly decided otherwise. See `ARCHITECTURE.md`
  §Module split for the trade-offs.
- **Stylized, not photoreal.** Spine text is larger and higher-contrast than a
  real book spine — deliberately. Legibility beats fidelity.

## Verifying a change

1. Open the file in a browser (Chrome / Firefox / Safari desktop).
2. Click to enter, walk to the bookcase (WASD + mouse).
3. Look at a spine — crosshair should turn gold and the prompt should appear.
4. Click to pull it out; click again to put it back.
5. Walk to the turntable, click to stop/start the record.
6. Press Esc, open the lil-gui panel, toggle post-processing off to see the
   raw scene without bloom.
7. Check the browser console for errors. The global `error` handler on the
   loading div will surface module-level throws.
