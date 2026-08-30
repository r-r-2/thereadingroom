# The Reading Room — agents guide

A first-person walkable 3D room containing a bookshelf, built with Three.js.
No build step, no framework, no bundler. Two files: `reading-room.html`
(scene + logic) and `books.js` (book data). Three.js and lil-gui load from
unpkg via an import map; cover images are fetched from Open Library on demand.

## Running it

```
python3 -m http.server
```
then open `http://localhost:8000/reading-room.html`.

A local server is required — `books.js` is a relative ES module import and
Chrome blocks those from `file://` URLs. No build step beyond that.

## Files

- **`reading-room.html`** — scene, lights, room, bookcase, decor,
  turntable, audio, controls, post-processing, animation loop.
- **`books.js`** — exported array of book objects. Edit this to add or update
  books. Fields: `t` (title), `a` (author), `c` (spine colour), `f` (text
  colour), `th` (thickness m), `h` (height m), `note`, `isbn`, and either
  `fin` (finished date string) or `reading` (0–100 percent in progress).

## Script layout

Everything in the HTML lives in one `<script type="module">`. Sections in order:

1. **Imports** — Three.js addons, lil-gui, and `BOOKS` from `./books.js`.
2. **Scene** — `THREE.Scene`, camera (eye at 1.62 m), renderer, ACES tone
   mapping, fog.
3. **Lights** — ambient, key, fill, shelfWash, candleLight, playerLight.
4. **Room shell** — floor with procedural plank texture, ceiling, four walls,
   a rug.
5. **Bookcase frame** — back panel, sides, top, toe board, shelf boards at
   y = 0.42 / 0.90 / 1.38 / 1.86.
6. **Book meshes** — `makeSpineTexture`, `makeCoverTexture`, `placeBooks()`,
   `loadCover()`. The `interactables` array is declared here, before
   `placeBooks()` runs.
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

1. Run `python3 -m http.server` and open `http://localhost:8000/reading-room.html`.
2. Click to enter, walk to the bookcase (WASD + mouse).
3. Look at a spine — crosshair should turn gold and the prompt should appear.
4. Click to pull it out; click again to put it back.
5. Walk to the turntable, click to stop/start the record.
6. Press Esc, open the lil-gui panel, toggle post-processing off to see the
   raw scene without bloom.
7. Check the browser console for errors. The global `error` handler on the
   loading div will surface module-level throws.
