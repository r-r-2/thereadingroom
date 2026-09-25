# The Reading Room — agents guide

A first-person walkable 3D room containing a bookshelf, built with Three.js.
No build step, no framework, no bundler. The room is `reading-room.html`
plus two data files (`books.js`, `guestbook.js`). Guest submissions go
through a small Cloudflare Worker (`worker/`) into GitHub Issues, then an
Action shelves approved ones. Three.js and lil-gui load from unpkg via an
import map; cover images are fetched from Open Library on demand.

## Running it

```
python3 -m http.server
```
then open `http://localhost:8000/reading-room.html`.

A local server is required — `books.js` is a relative ES module import and
Chrome blocks those from `file://` URLs. No build step beyond that.

## Files

- **`reading-room.html`** — scene, lights, room, window, bookcase, decor,
  reading table, guest table, turntable, audio, controls, post-processing,
  animation loop.
- **`books.js`** — exported array of book objects. Edit this to add or update
  books. See **Adding a book** below for the full field schema.
- **`guestbook.js`** — approved guest recommendations on the table by the
  door. Appended by the shelving Action, or by hand. See **Guest
  recommendations** below.
- **`worker/`** — Cloudflare Worker that files `recommendation` issues for
  anonymous guests. Deploy notes in `worker/README.md`.

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

## Guest recommendations

Visitors leave a book on the **guest table** (front wall, right of the
door) without a GitHub account. The in-room form `POST`s to the Worker
in [`worker/`](worker/README.md), which files a `recommendation` issue.
The guest sees their book on the table immediately, with an "awaiting
approval" tag. Other visitors see pending titles only in the ledger
(`GUEST_PENDING_ON_TABLE = false`).

### Shelving a recommendation

1. Open the issue. Add the **`approved`** label.
2. `.github/workflows/shelve-recommendation.yml` appends the entry to
   [`guestbook.js`](guestbook.js), commits to the default branch, and
   closes the issue. Pages redeploys; the tag comes off for everyone.
3. Close without `approved` to decline. The submitter's local copy is
   dropped on their next visit.

Edit `guestbook.js` by hand if you want to tweak a `why` line or drop
an entry. The seed entry (`id: 0`) is a stand-in; delete it once real
guests arrive.

### Relay setup (once)

See [`worker/README.md`](worker/README.md). Paste Cloudflare + GitHub
tokens into Actions secrets, run **Deploy guestbook worker**, then put
the printed URL in `GUEST_RELAY_URL` in `reading-room.html`. Until that
string still contains `YOUR-SUBDOMAIN`, the form saves in this browser
only (fine for local testing). Abuse limits live in `worker/worker.js`:
20 entries per IP, 3/min burst, no links, duplicate and flood guards.

## Script layout

Everything in the HTML lives in one `<script type="module">`. Sections in order:

1. **Imports** — Three.js addons, lil-gui, `BOOKS` from `./books.js`,
   and `GUESTS` from `./guestbook.js`.
2. **Scene** — `THREE.Scene`, camera (eye at 1.62 m), renderer, ACES tone
   mapping, fog.
3. **Lights** — ambient, key, fill, shelfWash, windowLight, candleLight,
   lampLight, playerLight.
4. **Room shell** — floor with procedural plank texture, ceiling, four walls,
   closed door on the front wall (opposite the bookcase), left-wall
   book nook (landscape window, bench seat, flanking curio shelves, decor).
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
11. **Guest table** — table by the door, ledger, quill, ghost slot, sign,
    `layBookOnTable()`, guestbook overlay, first-visit toast.
12. **Turntable** — credenza, plinth, platter, record, spindle, tonearm.
    Tonearm hit targets added to `interactables`.
13. **Music** — `Music` IIFE wrapping the Web Audio graph (pads, plucks,
    delay, vinyl hiss).
14. **Controls** — `PointerLockControls` on desktop; on touch, drag-to-look
    plus a virtual stick, with Cover / Leave a book / Leave buttons.
    Shared `inRoom` flag, keyboard map, velocity/collision.
15. **Raycast interaction** — book pull-out, wall lever, detail
    panel, record toggle, guestbook / guest-add. Taps raycast from the
    finger; clicks use the center crosshair.
16. **Animation loop** — movement, turntable rotation, arm travel, cover
    mode / book animation, pending-tag bob, `composer.render()`.

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

## Git commits

Follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/).

```
<type>[optional scope]: <description>
```

- **type:** `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, or `chore`
- **scope** (optional): `room`, `books`, `guestbook`, `worker`, `audio`, `window`, `mobile`
- **description:** imperative, lowercase, no trailing period — the *why* more than a file list
- Body is optional. Breaking changes use a `BREAKING CHANGE:` footer, or `!` after the type (`feat(guestbook)!: …`)
- One concern per commit. Do not mix unrelated work.

Examples:

```
feat(analytics): track page views and room interactions with GA4
fix(mobile): invert stick so forward matches look direction
docs: record conventional commit format
chore(worker): bump wrangler in the deploy workflow
```

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
9. Face the left wall: a built-in book nook — large landscape window over a
   cushioned bench with pillows, flanked by wood curio towers (framed art,
   ceramics, sculptures; books only as accents) and brass sconces — across
   from the turntable. You should not be able to walk through the bench.
10. Face the wall opposite the bookcase: a closed paneled wooden door with
    casing and a knob should sit on the left side of that wall.
11. Walk left of the bookcase: a wooden reading table with a lamp and
    plant. You should not be able to walk through it. Each `reading`
    book should show a burgundy ribbon bookmark in the pages, at a
    depth matching its progress; pull it out and the ribbon stays put.
    Cover-mode should leave table books (and their ribbons) alone.
12. Walk to the turntable, click to stop/start the record.
13. Check the browser console for errors. The global `error` handler on the
    loading div will surface module-level throws.
14. On a phone (or DevTools device mode): the gate should list drag / stick /
    tap, not WASD. Tap to enter — a walk stick, Covers, Leave a book, and
    Leave appear. Drag looks around; the stick walks; tap a book to pull
    it out; Leave returns to the gate without re-entering from the same tap.
15. The Look / lil-gui panel must be absent on the default URL. Open
    `reading-room.html?edit=1`, press Esc (or stay on the gate): the panel
    should appear. Toggle post-processing off to see the raw scene without
    bloom. Without the query param, leaving the room must not show it.
16. Turn around at spawn. A table by the door holds an open guestbook, a
    quill, a standing sign that reads "Recommend a book for me / Click
    the quill", and a ghost slot that reads "your book goes here". You
    cannot walk through the table. A first-visit toast points at it.
    Click the quill / ghost / sign / table top — the room stays visible
    under a dim overlay; the form is a cream open book (pointer unlocks
    on desktop, Esc / dimmer / Close re-locks). Click the ledger — two
    cream pages, Guestbook and Waiting, not a dark card. Submit a book
    (relay optional locally) — it appears on the table with an "awaiting
    approval" tag, listed on the Waiting page in lighter ink. Pull it
    out: meta reads "waiting for approval". Shelved entries in
    `guestbook.js` sit on the table and on the Guestbook page; there is
    no Left Hand of Darkness seed.
