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

- **`reading-room.html`** — scene, lights, room, window, bookcase, decor,
  reading table, turntable, audio, controls, post-processing, animation loop.
- **`books.js`** — exported array of book objects. Edit this to add or update
  books. See **Adding a book** below for the full field schema.

## Adding a book

Edit only [`books.js`](books.js). Do not change placement logic in
`reading-room.html` unless shelf or table capacity is exceeded.

### Fields

| Field | Required | Meaning |
| --- | --- | --- |
| `t`, `a` | yes | title, author |
| `c`, `f` | yes | fallback spine background / text colour (hex) |
| `th`, `h` | yes | thickness / height in metres |
| `isbn` | yes | ISBN-13 preferred; Open Library cover + title link |
| `cover` | optional | local jacket path when Open Library has no image |
| `fin` **or** `reading` | one of | finished date (`'Oct 2025'`) or progress `0–100` |
| `note` | optional | short detail-panel line; omit or `''` to hide |
| `review` | optional | longer personal review; Review section only if set |
| `spineC`, `spineF` | optional | precomputed spine colours; skips image sampling |

Finished books use `fin` and omit `reading`. In-progress books use `reading`
and omit `fin`.

Size heuristics from current entries: `th` ≈ `0.014`–`0.030`, `h` ≈ `0.178`–`0.229`.

### Shelf order

- Books with `reading` lie **cover-up** on the **reading table** (left of
  the bookcase). The first **four** sit in a row; further titles stack on
  the leftmost book.
- Finished books fill the lower three shelves in **array order**: 5 / 5 /
  remainder. The top shelf is decor only.
- Face-out mode packs at most two covers per lower shelf (**6** finished
  books look clean). More still works in spine mode but overlaps face-out.
  Table books ignore cover-mode.

Append finished books at the end of the array. `reading` books can sit
anywhere; they are filtered onto the table.

### Templates

Finished:

```js
{ t: 'Title', a: 'Author', c: '#1A1A1A', f: '#F0F0F0', th: .022, h: .216,
  note: '', isbn: '978XXXXXXXXXX', fin: 'Mon YYYY' },
```

Reading now (optional review):

```js
{ t: 'Title', a: 'Author', c: '#1A1A1A', f: '#F0F0F0', th: .022, h: .216,
  isbn: '978XXXXXXXXXX', reading: 40, review: 'Optional longer review…' },
```

### Optional `spineC` / `spineF`

After the page loads, Open Library covers are fetched. If `spineC` is
missing, the console logs paste-ready values:

```
[spine] "Title"
  spineC: 'rgb(...)', spineF: '#...'
```

Safe to omit on first add.

### Detail panel behaviour

- Pull a book out to open the panel. `note` shows only when set; a labeled
  **Review** block shows only when `review` is set.
- Press Esc, then click the title — opens
  `https://openlibrary.org/isbn/{isbn}` in a new tab. The panel stays
  above the entry gate so the link is clickable.

## Script layout

Everything in the HTML lives in one `<script type="module">`. Sections in order:

1. **Imports** — Three.js addons, lil-gui, and `BOOKS` from `./books.js`.
2. **Scene** — `THREE.Scene`, camera (eye at 1.62 m), renderer, ACES tone
   mapping, fog.
3. **Lights** — ambient, key, fill, shelfWash, windowLight, candleLight,
   lampLight, playerLight.
4. **Room shell** — floor with procedural plank texture, ceiling, four walls,
   a rug, left-wall nature window (canvas view, frame, sill, mullion).
5. **Bookcase frame** — back panel, sides, top, toe board, shelf boards at
   y = 0.42 / 0.90 / 1.38 / 1.86.
6. **Book meshes** — `makeSpineTexture`, `makeCoverTexture`, `placeBooks()`,
   `loadCover()`, wall lever and plaque. The `interactables` array is
   declared here, before `placeBooks()` runs.
7. **Post-processing** — `EffectComposer` with bloom, vignette, output pass.
8. **Design harness** — `SETTINGS` object and lil-gui panel (visible only
    with `?edit=1`).
9. **Decor** — shelf props: succulents, candles, flat book stacks, framed
   prints, vase, candleLight.
10. **Reading table** — top, legs, apron, lamp, succulent, `placeTableBooks()`.
11. **Turntable** — credenza, plinth, platter, record, spindle, tonearm.
    Tonearm hit targets added to `interactables`.
12. **Music** — `Music` IIFE wrapping the Web Audio graph (pads, plucks,
    delay, vinyl hiss).
13. **Controls** — `PointerLockControls` on desktop; on touch, drag-to-look
    plus a virtual stick, with Cover / Leave buttons. Shared `inRoom` flag,
    keyboard map, velocity/collision.
14. **Raycast interaction** — book pull-out, wall lever, detail
    panel, record toggle. Taps raycast from the finger; clicks use the
    center crosshair.
15. **Animation loop** — movement, turntable rotation, arm travel, cover
    mode / book animation, `composer.render()`.

See `ARCHITECTURE.md` for the how and why of each section.

## Constraints

- **No realtime shadows.** Performance trap at browser scale. Bake into
  textures if shadows are ever needed.
- **Touch is first-person, not a 2D shelf.** Pointer Lock is unsupported on
  iOS Safari, so phones and tablets use drag-to-look, a virtual stick, and
  tap-to-interact. Desktop keeps Pointer Lock + WASD. Cap pixel ratio at
  1.25 on touch. Do not add a separate mobile scene unless that is an
  explicit product change.
- **Single file** unless explicitly decided otherwise. See `ARCHITECTURE.md`
  §Module split for the trade-offs.
- **Stylized, not photoreal.** Spine text is larger and higher-contrast than a
  real book spine — deliberately. Legibility beats fidelity.

## Verifying a change

1. Run `python3 -m http.server` and open `http://localhost:8000/reading-room.html`.
2. Click to enter, walk to the bookcase (WASD + mouse).
3. Look at a spine — crosshair should turn gold and the prompt should appear.
4. Click to pull it out; click again to put it back.
5. If the book has a `review`, the detail panel should show a Review section;
   if not, that section should be absent. Empty `note` should leave no gap.
6. With a book open, press Esc, then click the title — Open Library should
   open in a new tab without re-locking the pointer.
7. Walk to the wall left of the bookcase. A large plaque should read
   "Click the lever / or press C / to flip covers". Look at the lever
   — prompt should read "Click to show covers". Click it — the handle
   throws down and books rotate face-out on the left of the three
   lower shelves, clear of the decor. Press C to flip back to spines.
8. In both modes, pull a book out and put it back. Cover mode should
   nudge forward only (no extra quarter-turn). Table books (if any
   `reading` entries exist) should stay on the table, lying cover-up.
9. Face the left wall: a large framed window should show a stylized
   landscape (mountains, trees, plants) across from the turntable.
10. Walk left of the bookcase: a wooden reading table with a lamp and
    plant. You should not be able to walk through it.
11. Walk to the turntable, click to stop/start the record.
12. Check the browser console for errors. The global `error` handler on the
    loading div will surface module-level throws.
13. On a phone (or DevTools device mode): the gate should list drag / stick /
    tap, not WASD. Tap to enter — a walk stick, Covers, and Leave appear.
    Drag looks around; the stick walks; tap a book to pull it out; Leave
    returns to the gate without re-entering from the same tap.
14. The Look / lil-gui panel must be absent on the default URL. Open
    `reading-room.html?edit=1`, press Esc (or stay on the gate): the panel
    should appear. Toggle post-processing off to see the raw scene without
    bloom. Without the query param, leaving the room must not show it.
