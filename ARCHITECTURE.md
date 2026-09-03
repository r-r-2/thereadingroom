# Architecture

## Scene graph

```
THREE.Scene
├── ambient (AmbientLight, 0xffeaCF, intensity 0.62)
├── key (PointLight, 0xffc078, intensity 19, range 10)
├── fill (PointLight, 0xd8cbb4, intensity 7, range 12)
├── shelfWash (PointLight, 0xffd9a0, intensity 7, range 4.6)
├── windowLight (PointLight, 0xffd4a8, intensity 5.5, range 4.2)
├── playerLight (PointLight, 0xffc98a, intensity 3.2, range 2.4)
├── floor (Mesh)
├── ceiling (Mesh)
├── four wall planes (Mesh ×4)
├── doorGroup (Group, front wall left side, opposite bookcase, rotated π)
│   ├── casing, threshold, closed slab, recessed panels
│   └── knob (sphere + stem + backplate)
├── windowGroup (Group, left wall, rotated π/2, z ≈ −0.4)
│   ├── landscape view plane (canvas texture)
│   ├── frame rails, mullion, sill
│   └── (windowLight is scene-parented, not in this group)
├── wallSwitch (Group, back wall left of the bookcase)
│   ├── lever plate, bezel, pivot, arm, knob
│   └── instruction plaque
├── shelfGroup (Group, z = -ROOM.d/2 + 0.19)
│   ├── bookcase panels and shelf boards (Mesh ×9)
│   ├── finished-book meshes (Mesh ×N, added by placeBooks())
│   ├── decor objects (Groups and Meshes)
│   └── candleLight (PointLight, parented to shelfGroup)
├── tableGroup (Group, left of the bookcase)
│   ├── top, apron, legs
│   ├── lamp (base, stem, shade, glow) + lampLight
│   ├── succulent
│   └── reading-book meshes (placeTableBooks())
└── player (Group, at far-right corner, rotated −π/2)
    ├── credenza (Mesh)
    ├── plinth (Mesh)
    ├── platter (Mesh)
    ├── record (Mesh)
    ├── spindle (Mesh)
    └── arm (Group — pivot point for tonearm rotation)
        ├── armBase (Mesh)
        ├── armTube (Mesh)
        └── headshell (Mesh)
```

`PointerLockControls` wraps the camera; the camera is added directly to the
scene (the controls object / `controls.getObject()` is the camera itself in
Three.js r170). On touch devices, Pointer Lock is skipped: the same camera
is yaw/pitched from drag, and `moveForward` / `moveRight` still drive walking.

## Real-world units

Everything is in metres. Eye height is 1.62 m; books are 17.2–23.8 cm tall
and 1.6–5.5 cm thick. Shelf boards sit at y = 0.42, 0.90, 1.38, 1.86. Room
is 7 m wide × 6.4 m deep × 2.9 m tall. Scale being correct is why the room
feels inhabited; a uniform 15 % error is invisible in isolation but makes
every proportion feel wrong.

## Lights

Eight light sources in total (not three as originally noted):

| Name | Type | Colour | Initial intensity |
|---|---|---|---|
| ambient | AmbientLight | 0xffeaCF | 0.62 |
| key | PointLight | 0xffc078 | 19 |
| fill | PointLight | 0xd8cbb4 | 7 |
| shelfWash | PointLight | 0xffd9a0 | 7 |
| windowLight | PointLight | 0xffd4a8 | 5.5 |
| candleLight | PointLight | 0xffb765 | 0.9 |
| lampLight | PointLight | 0xffc98a | 1.4 |
| playerLight | PointLight | 0xffc98a | 3.2 |

No realtime shadows anywhere. `MeshLambertMaterial` is used throughout
(faster per-vertex lighting); `MeshPhongMaterial` is used only on the glazed
succulent pots where the specular highlight is doing the visual work.
`MeshBasicMaterial` (emissive, unaffected by scene lighting) is used for
candle flames so that bloom can glow them.

## Book mesh construction

Each book is a `BoxGeometry` with an array of six materials. Three.js face
order is `[+x, −x, +y, −y, +z, −z]`. Mapping:

```
mats = [cover, cover, PAGE_MAT, PAGE_MAT, spine, PAGE_MAT]
         +x     −x      +y        −y        +z      −z
```

`+z` faces the room (spine), `±x` are the front and back covers, the
remaining three faces are the page block. A wall-mounted lever to the
left of the bookcase lerps **shelf** books to a face-out rest pose
(`rotation.y = −π/2`) so `+x` faces the room. Table books skip that blend.
Do not put the jacket texture on `+z` — that face
is only 1.4–3 cm wide and would squash the cover.

### Spine texture (`makeSpineTexture`)

Drawn to a 128 × 640 canvas at runtime:
1. Flood-fill with the book's spine colour.
2. Linear gradient across the width to fake curvature (dark edges,
   light centre).
3. Two thin horizontal bands near top and bottom (common spine design
   motif).
4. Title text rotated −90° and centred. Font size starts at 46 px and
   steps down by 2 until the text fits within 470 px, flooring at 18 px.

### Cover texture (`makeCoverTexture`)

Drawn to a 256 × 384 canvas: spine colour as background, diagonal
gradient, title word-wrapped to ≈200 px, author below. This face is
rarely visible; it exists so covers aren't black when the player
walks around a book mid-pull.

To swap in real cover images, replace `makeCoverTexture` with a
`THREE.TextureLoader` call. Set `crossOrigin` on the loader. Past ≈50
books, pack them into a texture atlas — one texture per book creates
50 `gl.texImage2D` calls on startup.

### Book placement (`placeBooks` / `placeTableBooks`)

Finished books (`!reading`) fill the three lower shelves in declaration
order (5 / 5 / remainder across SHELF_Y[2..0]). The top shelf is decor
only. Books with `reading` lie cover-up on the reading table to the left
of the bookcase (`placeTableBooks`). The first four sit in a row on the
tabletop; further titles stack on the leftmost book, each still its own
interactable. Cover-mode does not stand them up or send them to a shelf.
Each table book gets a burgundy ribbon child (`addBookmark`) inserted
through the page block at `reading / 100` and sticking out of the
table-front edge; it is posed once and rides with pull-out.

Each shelf book is offset from the previous by its thickness plus a 4 mm
gap. A small random Z-lean (`rotation.z ±0.015 rad`) keeps them from
looking machine-placed.

Shelf meshes store two rest poses: `spineHome` / `spineRotY = 0` (current
row) and `faceHome` / `faceRotY = −π/2`. Face-out packs two covers per
lower shelf on the left of the board so they clear the decor (usable
left band is about 0.64 m). That is a hard cap of six face-out books;
more than that will overlap on the bottom shelf. Table books set
`onTable`, rotate `z = −π/2` so the jacket (`+x`) faces up, and copy
`spineHome` into `faceHome` so cover-mode is a no-op. Pull-out lifts them
in Y rather than applying the standing-spine quarter-turn.

The `interactables` array is declared at module scope **before**
`placeBooks()` is called. Each book mesh is pushed into it; the
cover-display lever (plate, arm, knob) and the tonearm hit targets
(record, platter, plinth) are pushed in later.

## Interaction model

A `THREE.Raycaster` fires from normalised device coordinate (0, 0) —
screen centre — every frame while the pointer is locked. `far` is 2.4 m.
It tests only the `interactables` array (never the full scene graph).

Each interactable carries `userData.type`: `'book'`, `'player'`, or
`'switch'`.

**Looking** at an object: crosshair scales up (`.hot` CSS class),
prompt text appears.

**Clicking** a book: sets `userData.out = true`. The animation loop
lerps `userData.t` toward 1 over roughly 0.1 s, applied **on top of**
the current rest pose (a blend of `spineHome` and `faceHome` by
`coverT`):
- Spine mode (`coverT ≈ 0`): `z + 0.17`, `y + 0.012`, `rotation.y += −0.95`
- Cover mode (`coverT ≈ 1`): forward nudge only (`z + 0.06`). The jacket
  already faces the room; another quarter-turn would hide it.
- Table books (`onTable`): lift `y + 0.08` and `z + 0.06`; no Y spin, so
  the jacket stays facing up.

Clicking again while looking at the open book closes it (`out = false`,
`t` lerps back to 0). Clicking a different book while one is open first
closes the open one.

The detail panel (`#detail`) shows title, author, optional `note`, optional
`review` (labeled section only when set), and finished / reading meta.
The title is an `<a>` to `https://openlibrary.org/isbn/{isbn}`. While the
panel is open it uses `pointer-events: auto` and `z-index` above the entry
gate, so after Esc the player can click the title without the gate
re-locking the pointer. Gate clicks ignore targets inside `#detail`.

**Clicking** the turntable (record, platter, or plinth): toggles
`Music.toggle()`.

**Clicking** the wall lever (plate, arm, or knob), or pressing **C**
while the pointer is locked: calls `toggleCoverMode()`. Any open book
is closed first so the two animations do not fight. The lever throws
up (spines) and down (covers) with `coverT`. `keydown` ignores
`e.repeat` so holding C does not flicker. A plaque above the lever
reads "Click the lever / or press C / to flip covers". Prompts:
`Click to show covers` / `Click to show spines`.

## Movement and collision

`PointerLockControls` handles mouse look on desktop. On `(hover: none) and
(pointer: coarse)` — and if Pointer Lock errors or never arrives on a
touch laptop/iPad — drag on the canvas yaws/pitches the camera (`YXZ`
Euler) and a virtual stick on the left feeds the same `dir` vector as
WASD. `inRoom` gates movement and interaction in both modes.

Movement approaches a wish velocity with exponential smoothing each frame
(`ACCEL = 12`). `SETTINGS.moveSpeed` is the max local speed in m/s
(default `2.4`, matching the old steady-state of accel `22` / damp `9`):

```js
wishVel.set(dir.x, 0, dir.z).multiplyScalar(SETTINGS.moveSpeed);
const k = 1 - Math.exp(-ACCEL * dt);
velocity.x += (wishVel.x - velocity.x) * k;
velocity.z += (wishVel.z - velocity.z) * k;
```

Key state is read with explicit ternaries, never `Number(keysMap[code])`.
See GOTCHAS.md for why.

A `Number.isFinite` guard resets velocity if NaN ever enters.

Collision is a bounding-box clamp in `collide()`:
1. Room walls: clamp x and z inside the room minus a 0.42 m padding.
2. Bookcase footprint: if the player is within the case's x-extent and
   tries to move past `CASE_MAX_Z`, clamp z to that boundary.
3. Reading table AABB: if inside the table's x/z box, push to the
   nearest face so the player can walk around it but not through it.
4. Eye height: `position.y` is always reset to 1.62. There is no
   gravity and no jumping.

When the clamp corrects position, local velocity is rebuilt from the
actual world delta projected onto the camera's right/forward axes so the
player slides along surfaces instead of fighting leftover speed into them.

## Turntable

The player group is placed at the far right of the room and rotated −π/2
so it faces into the room. The tonearm pivots from a Group at
`(0.17, 0.83, −0.13)` in player-local space.

**Geometry solved against numbers:**
- Pivot is 0.247 m from the record centre (player-local XZ).
- Arm tube extends 0.228 m to the headshell.
- `ARM_PARK = 0.404` clears the platter.
- `ARM_OUTER = −0.459` lands the stylus 0.132 m from the record
  centre (grooved area starts just inside the 0.148 m record edge).
- `ARM_INNER = −0.710` reaches 0.075 m, just outside the label.

When playing, `armTravel` increments by `dt / 420` each frame (capped
at 0.05 s/frame). At 60 fps that is 7 minutes from outer groove to
run-out.

The record and platter rotate at 3.49 rad/s = 33⅓ rpm.

## Audio graph

```
Oscillators (pads) ──┐
Oscillators (plucks)─┤──► padGain ──────────────────────────────┐
                     │                                           │
                     │     ┌─► damp (lowpass 1400 Hz) ──► fb ──┤
                     └─────┤                                     │
                     pluck─┤───► delay (0.46 s) ──────► wet ───┤
                           │                                     │
                           └── (pluck goes directly to padGain) │
                                                                 ▼
noiseSource ──► nf (bandpass 3200 Hz) ──► noiseGain ──► tone (lowpass 2200 Hz)
                                                                 │
                                              padGain ──────────►│
                                              wet ───────────────┘
                                                                 ▼
                                                              master (gain)
                                                                 │
                                                         ctx.destination
```

**Chords:** Dm7 → Fmaj7 → Am7 → Gm7, cycling, each lasting 9.5 s. Each
chord is four oscillators alternating `sine` / `triangle`, detuned by up
to ±4.5 cents.

**Plucks:** 2–3 per chord, drawn from D minor pentatonic two octaves up
(`[587.33, 698.46, 783.99, 880.0, 1046.5, 1174.66]` Hz). Each is a sine
with a 20 ms attack and 2.6 s decay, fed into both the pad gain and the
delay.

**Vinyl hiss:** white noise through a 3200 Hz bandpass, gain 0.012.

**Distance falloff:** `Music.updateListener(camPos, srcPos)` computes a
linear falloff between 1.2 m (full volume) and 7 m (38 % volume) and
applies it to `master.gain`. Simpler and cheaper than a `PannerNode`.

The `AudioContext` is not created until `Music.start()` is called, which
happens inside `enterRoom()` — the earliest moment a user gesture is
guaranteed (pointer-lock on desktop, tap-to-enter on touch).

## Post-processing chain

```
RenderPass → UnrealBloomPass → ShaderPass(VignetteShader) → OutputPass
```

`EffectComposer` pixel ratio is set explicitly:
```js
composer.setPixelRatio(pixelRatio()); // 2 desktop, 1.25 touch
```
Without this it renders at roughly half resolution. See GOTCHAS.md.

Bloom parameters: strength 0.16, radius 0.45, threshold 0.90. The high
threshold means only the brightest surfaces (candle flames via
`MeshBasicMaterial`) bloom visibly. Emissive geometry and bloom amplify
each other — tune them together.

## Design harness (lil-gui)

The panel is visible only with `?edit=1` in the URL, and then only when
the pointer is unlocked (the entry gate). Visitors never see it. It edits
a `SETTINGS` object and applies changes live to the scene. When the look
feels right, "Copy settings" writes `JSON.stringify(SETTINGS)` to the
clipboard. Paste the values you want back into the source as new
hardcoded defaults.

**Important:** `SETTINGS` is initialised with values that were set at an
earlier stage of development. Several of them do not match the current
hardcoded scene initialisation values (see GOTCHAS.md). Before copying
settings, verify that any slider you did not move shows the actual scene
value — adjust it if not.

Folders:
- **Grade** — tone mapping exposure, bloom (strength / radius / threshold),
  vignette (offset / darkness), global post-processing on/off toggle.
- **Lighting** — ambient, key, fill, and shelf wash colours and intensities.
  Key position (x/y/z).
- **Room** — fog near/far, FOV, move speed.
- **Sound** — volume slider, play/pause toggle.
