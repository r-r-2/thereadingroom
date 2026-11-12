# The Reading Room — Agents Guide (v2 + v1 Time Capsule)

A first-person walkable 3D room containing a personal bookshelf, built with
Three.js (`0.172.0`), Physically Based Rendering (PBR), cached soft shadows,
half-res screen-space ambient occlusion (`N8AO`), a 3D parallax exterior with
Golden Hour ↔ Cozy Rainy Dusk weather moods, and HRTF 3D spatial audio.

**Zero build step, no framework, no bundler.** Static native ES modules
(`reading-room.html` + `src/*.js`) plus two shared data files (`books.js`,
`guestbook.js`). Guest submissions go through a Cloudflare Worker (`worker/`)
into GitHub Issues, then an Action shelves approved ones.

The original 2025 single-file stylized Lambertian room is preserved verbatim
at **`v1.html`** for nostalgia, reading from the **exact same `./books.js`
and `./guestbook.js`** so new books and approved guest recommendations appear
automatically in both v1 and v2.

## Running it

```bash
python3 -m http.server
```

Then open:
- **v2 (default):** `http://localhost:8000/reading-room.html`
- **v1 (older):** `http://localhost:8000/v1.html`
- **Design & automation harness:** `http://localhost:8000/reading-room.html?edit=1`

A local HTTP server is required — ES module imports (`./src/main.js`,
`./books.js`, `./guestbook.js`) are blocked from `file://` URLs.

## Files & Module Layout

- **`reading-room.html`** — v2 HTML shell, CSS, import map (`three@0.172.0`,
  `postprocessing@6.36.6`, `n8ao@1.9.4`, `lil-gui`), HUD pills, book detail
  drawer, cream two-page guestbook modal, touch controls, and link to `v1.html`.
- **`v1.html`** — frozen 2025 single-file original room with reciprocal
  `Step into v2 ->` link on the entry gate. Shares `./books.js` and `./guestbook.js`.
- **`src/`** — modular v2 ES source files (no bundler):
  - `src/main.js` — scene orchestration, animation loop, book pull/arc lerp,
    HUD state sync, `?edit=1` `lil-gui` & `window.__room` automation harness.
  - `src/constants.js` — physical dimensions in metres (`ROOM`, `NOOK`, `CASE`,
    `SHELF_Y`, `TABLE`, `GUEST_TABLE`, `GUEST_LEDGE`, `STAND`, tonearm angles) + `damp()`.
  - `src/state.js` — single-source-of-truth `SETTINGS`, persisted user prefs
    (`mood`, `headBob`, `quality`), shared `runtime`, `interactables`, `books`.
  - `src/quality.js` — `ultra` / `high` / `mobile` quality tiers (all visitors start on
    `mobile`/Fast; a tier is remembered only once chosen) + automatic
    low-FPS (<43 FPS) AO step-down watchdog.
  - `src/renderer.js` — `WebGLRenderer`, cached `PCFSoftShadowMap`, and merged
    `pmndrs/postprocessing` (`N8AOPostPass`, `DepthOfFieldEffect` on book
    inspection, Mipmap `BloomEffect`, `ToneMappingMode.AGX`, `VignetteEffect`, `SMAAEffect`).
  - `src/materials.js` — procedural PBR surface maps (wide-plank oak albedo,
    normal & per-plank roughness; limewash plaster stipple; wood grain; fabric
    weave; `MeshPhysicalMaterial` linen sheen, glazed ceramics, refractive glass, wax).
  - `src/lighting.js` — warm interior `PMREMGenerator` IBL environment,
    cached directional sun shadow map, `RectAreaLight` window bounce, indoor
    lamps/sconces/candles, and live **Golden Hour ↔ Cozy Rainy Dusk** interpolation.
  - `src/room.js` — oak plank floor, woven wool center rug (`RUG_BOUNDS`),
    plaster walls with window cutout, perimeter baseboards & crown molding,
    and 4-panel entry door with brass lever hardware & hallway light sliver.
  - `src/exterior.js` — 3D parallax outdoor pocket world outside the left-wall
    window (GLSL sky dome, 4 depth-layered mountain ridges, valley mist,
    wind-swaying 3D pines, 3D bird flock, falling rain streaks,
    volumetric sunbeams).
  - `src/window-nook.js` — mullioned oak window, physical glass + GLSL animated
    rain-droplet overlay, breathing sheer linen curtains, interactive brass
    **Window-Sill Mood Switch**, cushioned bench, flanking curio towers & sconces.
  - `src/props.js` — reusable PBR prop builders (succulents, potted plants,
    wax candles with Rainy Dusk flames, ceramic/glass vases, flat book stacks,
    framed art/prints, curio sculptures).
  - `src/books.js` — bookcase carpentry, `RoundedBoxGeometry` tactile books,
    spine/jacket canvas textures, Open Library + `./covers/` loader, brass wall
    lever, and 4-row Cover Exhibition arc layout.
  - `src/tables.js` — reading table, brass lamp, and cover-up `reading` books
    with burgundy silk ribbon bookmarks.
  - `src/guestbook.js` — guest table, embossed leather ledger with page-open
    animation, refractive inkwell + quill, ghost slot, wall picture ledges,
    Cloudflare Worker `POST`, GitHub Issues sync, and cream open-book modal.
  - `src/turntable.js` — credenza, vinyl LP sleeves, brushed metal platter,
    anisotropic radial micro-groove LP, S-tonearm, and acrylic dust cover.
  - `src/gallery.js` — right-wall 7-poster salon (`./posters/*.jpg`) in a
    3-over-4 grid with beveled oak frames, cream matboards & museum glass.
  - `src/audio.js` — generative synth LP routed through an HRTF 3D `PannerNode`
    at the turntable, spatialized Rainy Dusk window audio, and procedural foley
    (oak vs. rug footsteps, book paper slide, brass switch clicks).
  - `src/controls.js` — desktop `PointerLockControls` + WASD + shortcuts (`C`,
    `M`, `B`, `Q`/`G` quality, `V` vinyl, `L` leave a book), mobile drag-to-look + virtual stick + tap raycast, furniture
    AABB collisions, and subtle toggleable footstep-synced head-bob.
- **`books.js`** — exported array of book objects (shared by v2 and v1).
- **`guestbook.js`** — approved guest recommendations (shared by v2 and v1).
- **`worker/`** — Cloudflare Worker that files `recommendation` issues for
  anonymous guests. Deploy notes in `worker/README.md`.
- **`PLAN.md`**, **`ARCHITECTURE.md`**, **`GOTCHAS.md`** — living architecture
  decisions, scene invariants, and past bug post-mortems. Keep these updated
  whenever changing rendering, module boundaries, or interaction rules.

## Adding a book

Edit only [`books.js`](books.js). Both `reading-room.html` (v2) and `v1.html`
consume it automatically.

### Fields

| Field | Required | Meaning |
| --- | --- | --- |
| `t`, `a` | yes | title, author |
| `c`, `f` | yes | fallback spine background / text colour (hex) |
| `th`, `h` | yes | thickness / height in metres |
| `isbn` | yes | ISBN-13 preferred; Open Library cover + title link |
| `cover` | optional | local jacket path (`./covers/...`) when Open Library has no image |
| `fin` **or** `reading` | one of | finished date (`'Oct 2025'`) or progress `0–100` |
| `row` | finished books | `'people'` (upper), `'other'` (middle), or `'fiction'` (bottom) |
| `y` | optional | numeric sort year when `fin` has no 4-digit year (e.g. `'2000s'`) |
| `note` | optional | short detail-panel line; omit or `''` to hide |
| `review` | optional | longer personal review; Review section only if set |
| `spineC`, `spineF` | optional | precomputed spine colours; skips image sampling |

### Shelf & Table Order

- Books with `reading` lie **cover-up** on the **reading table** (left of the
  bookcase) with a burgundy ribbon bookmark positioned at `reading`%.
- Finished books (`!reading`) sort chronologically left-to-right onto the
  lower three shelves by `row`: `people` → `SHELF_Y[2]`, `other` → `SHELF_Y[1]`,
  `fiction` → `SHELF_Y[0]` (with Harry Potter kept together as a contiguous block).
  The top shelf (`SHELF_Y[3]`) is decor only.
- Cover Exhibition Mode (`C` key, HUD button, or brass wall lever) dims the
  bookcase wood and floats shelf books into four shallow rows: `people` on top,
  `other` (non-fiction) second, `fiction` third, and `Harry Potter` on its own
  row underneath. Table books stay put on the table.

## Guest recommendations

Visitors leave a book on the **guest table** (front wall, right of the door)
without a GitHub account. The in-room form `POST`s to `GUEST_RELAY_URL`
(`worker/worker.js`), which files a `recommendation` GitHub Issue.

- The submitter sees their book on the table immediately with a bobbing
  **"awaiting approval"** tag (`localStorage` key `rr-guest-mine`).
- Other visitors see pending titles on the **Waiting** page of the ledger
  (`GUEST_PENDING_ON_TABLE = false`).
- The newest three approved books (`GUEST_ON_TABLE = 3`) lie on the table,
  with guests in `GUEST_ALWAYS_ON_TABLE` (`['Swaa']`) always holding one of
  those three places with their newest book. Older approved books stand
  cover-out on the two wall picture ledges (`GUEST_LEDGE`) above the table.
- Adding the **`approved`** label to the GitHub issue triggers
  `.github/workflows/shelve-recommendation.yml`, appending the entry to
  `guestbook.js` and closing the issue.

## Key Constraints & Architectural Invariants

1. **Cached Soft Shadows (`shadow.autoUpdate = false`):** Never flip
   `renderer.shadowMap.autoUpdate = true`. Instead set
   `runtime.shadowsDirty = true` only when lighting mood, quality tier, or
   book positions change. This keeps shadow cost at ~0 ms/frame while walking.
2. **Import Map Compatibility:** Keep `"three/examples/jsm/"` mapped alongside
   `"three/addons/"` in `reading-room.html` — `n8ao` imports Three's `Pass.js`
   via `three/examples/jsm/postprocessing/Pass.js`.
3. **Preserve `v1.html` & Shared Data:** Never fork `books.js` or `guestbook.js`.
   Keep `v1.html` working as the frozen 2025 nostalgic edition.
4. **Touch is First-Person, Not a 2D Fallback:** Mobile/tablet uses drag-to-look,
   virtual walk stick, and tap raycasting, defaulting to the `mobile` (`Fast`)
   quality tier (1.25 max DPR, no SSAO/shadow maps).
5. **Subtle, Focus-Safe Head-Bob:** Head-bob must automatically damp to `0`
   whenever `runtime.looked` or `runtime.opened` is truthy so aiming at thin
   book spines or reading the inspection panel never jitters.
6. **Preserve `?edit=1` Harness:** When `?edit=1` is present, `window.__room`
   and `lil-gui` must be exposed so automated browser tests and look-tuning
   scripts can drive the room without Pointer Lock.

## Git commits

Follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/)
(see `.cursor/rules/conventional-commits.mdc`):

```
<type>[optional scope]: <description>
```

- **type:** `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, or `chore`
- **scope** (optional): `room`, `books`, `guestbook`, `worker`, `audio`, `window`, `mobile`
- **description:** imperative, lowercase, no trailing period — explain *why*
- One concern per commit.

## Verifying a change

**Automated (on demand):** `/verify-room` (skill in `.claude/skills/verify-room/`)
or `cd tools/verify && npm install && node verify.mjs check`. It runs headless
assertions on the working copy (console errors, table covers face-up with the spine
on the left, hover lift, Q/M/C keys, no NaN black blocks, gate copy, v1 link) and
prints only failures. `node verify.mjs visual [ref]` writes a before/after page
(`tools/verify/out/visual/index.html`) of fixed views versus `ref` (default
`main`) for a human to review. Keep the `window.__room` harness intact, because
the tool depends on it.

**Manual:**

1. Run `python3 -m http.server` and open `http://localhost:8000/reading-room.html`.
2. Click to step inside; verify zero console errors and smooth 60+ FPS walking
   (WASD + mouse, subtle footstep foley changing between oak floor and center rug).
3. Hover and click a spine on the bookcase: crosshair turns gold, book glides
   up in front of you, cover facing you, with background Depth-of-Field blur, detail drawer opens. Press
   `Esc` and click the book title to verify Open Library opens cleanly.
4. Flip the brass wall lever left of the bookcase (or press `C`): verify all
   4 rows of covers (`people`, `other`, `fiction`, `Harry Potter`) float out
   with jackets facing you. Pull a book out in Cover Mode and return to spines.
5. Press `M` (or click the brass toggle switch on the book-nook window sill):
   verify the room transitions smoothly between **Golden Hour** (sunbeams,
   birds, valley light) and **Cozy Rainy Dusk** (twilight sky,
   falling rain + animated glass droplets, rain audio, and warm indoor table
   lamp, sconces, gallery glow, and flickering wax candles turning ON).
6. Check the reading table (cover-up `reading` books with burgundy ribbons),
   right-wall turntable (click to lift/drop needle; HRTF spatial audio pans as
   you turn) + 7-poster framed salon, and front-wall 4-panel door + guestbook
   table (ledger, quill, ghost slot, Swaa's book).
7. Click `visit older v1 ->` on the entry gate and confirm `v1.html`
   loads cleanly and links back to v2 (`Step into v2 ->`).
