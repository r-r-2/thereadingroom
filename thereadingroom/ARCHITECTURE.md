# Architecture

## Scene graph

```
THREE.Scene
├── ambient (AmbientLight, 0xffeaCF, intensity 0.62)
├── key (PointLight, 0xffc078, intensity 19, range 10)
├── fill (PointLight, 0xd8cbb4, intensity 7, range 12)
├── shelfWash (PointLight, 0xffd9a0, intensity 7, range 4.6)
├── playerLight (PointLight, 0xffc98a, intensity 3.2, range 2.4)
├── floor (Mesh)
├── ceiling (Mesh)
├── four wall planes (Mesh ×4)
├── rug (Mesh)
├── shelfGroup (Group, z = -ROOM.d/2 + 0.19)
│   ├── bookcase panels and shelf boards (Mesh ×9)
│   ├── book meshes (Mesh ×17, added by placeBooks())
│   ├── decor objects (Groups and Meshes)
│   └── candleLight (PointLight, parented to shelfGroup)
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
Three.js r170).

## Real-world units

Everything is in metres. Eye height is 1.62 m; books are 17.2–23.8 cm tall
and 1.6–5.5 cm thick. Shelf boards sit at y = 0.42, 0.90, 1.38, 1.86. Room
is 7 m wide × 6.4 m deep × 2.9 m tall. Scale being correct is why the room
feels inhabited; a uniform 15 % error is invisible in isolation but makes
every proportion feel wrong.

## Lights

Six light sources in total (not three as originally noted):

| Name | Type | Colour | Initial intensity |
|---|---|---|---|
| ambient | AmbientLight | 0xffeaCF | 0.62 |
| key | PointLight | 0xffc078 | 19 |
| fill | PointLight | 0xd8cbb4 | 7 |
| shelfWash | PointLight | 0xffd9a0 | 7 |
| candleLight | PointLight | 0xffb765 | 0.9 |
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
remaining three faces are the page block.

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

### Book placement (`placeBooks`)

Books with `reading` go on the top shelf (SHELF_Y[3]); finished books
fill the lower three shelves in declaration order (5 / 5 / 4 split
across SHELF_Y[2..0]). Each book is offset from the previous by its
thickness plus a 4 mm gap. A small random Z-lean (`rotation.z ±0.015
rad`) keeps them from looking machine-placed.

The `interactables` array is declared at module scope **before**
`placeBooks()` is called. Each book mesh is pushed into it; the
tonearm hit targets (record, platter, plinth) are pushed in later.

## Interaction model

A `THREE.Raycaster` fires from normalised device coordinate (0, 0) —
screen centre — every frame while the pointer is locked. `far` is 2.4 m.
It tests only the `interactables` array (never the full scene graph).

Each interactable carries `userData.type`: `'book'` or `'player'`.

**Looking** at an object: crosshair scales up (`.hot` CSS class),
prompt text appears.

**Clicking** a book: sets `userData.out = true`. The animation loop
lerps `userData.t` toward 1 over roughly 0.1 s:
- `position.z += t × 0.17` (spine pulls toward viewer)
- `position.y += t × 0.012` (slight lift)
- `rotation.y = t × −0.95` (quarter-turn to left)

Clicking again while looking at the open book closes it (`out = false`,
`t` lerps back to 0). Clicking a different book while one is open first
closes the open one.

**Clicking** the turntable (record, platter, or plinth): toggles
`Music.toggle()`.

## Movement and collision

`PointerLockControls` handles mouse look. Movement uses an explicit
velocity vector with exponential damping each frame:

```js
velocity.x -= velocity.x * DAMP * dt;     // DAMP = 9
velocity.z -= velocity.z * DAMP * dt;
// ...then add dir * SETTINGS.moveSpeed * dt
```

Key state is read with explicit ternaries, never `Number(keysMap[code])`.
See GOTCHAS.md for why.

A `Number.isFinite` guard resets velocity if NaN ever enters.

Collision is a bounding-box clamp in `collide()`:
1. Room walls: clamp x and z inside the room minus a 0.42 m padding.
2. Bookcase footprint: if the player is within the case's x-extent and
   tries to move past `CASE_MAX_Z`, clamp z to that boundary.
3. Eye height: `position.y` is always reset to 1.62. There is no
   gravity and no jumping.

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
happens inside the `controls 'lock'` event — the earliest moment a user
gesture is guaranteed.

## Post-processing chain

```
RenderPass → UnrealBloomPass → ShaderPass(VignetteShader) → OutputPass
```

`EffectComposer` pixel ratio is set explicitly:
```js
composer.setPixelRatio(Math.min(devicePixelRatio, 2));
```
Without this it renders at roughly half resolution. See GOTCHAS.md.

Bloom parameters: strength 0.16, radius 0.45, threshold 0.90. The high
threshold means only the brightest surfaces (candle flames via
`MeshBasicMaterial`) bloom visibly. Emissive geometry and bloom amplify
each other — tune them together.

## Design harness (lil-gui)

The panel is visible when the pointer is unlocked. It edits a `SETTINGS`
object and applies changes live to the scene. When the look feels right,
"Copy settings" writes `JSON.stringify(SETTINGS)` to the clipboard. Paste
the values you want back into the source as new hardcoded defaults.

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
