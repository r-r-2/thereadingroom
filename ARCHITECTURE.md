# Architecture — The Reading Room v2

> **Edition Coexistence:** `reading-room.html` + `src/*.js` power **v2** (PBR,
> IBL, cached soft shadows, `N8AO`, 3D exterior, Golden Hour ↔ Rainy Dusk,
> HRTF spatial audio). **`v1.html`** preserves the original 2025 single-file
> `MeshLambertMaterial` scene verbatim. Both import the exact same `./books.js`
> and `./guestbook.js`.

---

## 1. Module Dependency Graph (`src/`)

```
reading-room.html (HTML shell, CSS, import map, HUD, detail drawer, guestbook modal)
 └── src/main.js (bootstrapping, animation loop, book lerp, HUD sync, ?edit=1 harness)
      ├── src/constants.js     (physical dimensions in metres, guestbook constants, damp)
      ├── src/state.js         (single-source SETTINGS, persisted prefs, runtime, interactables)
      ├── src/quality.js       (ultra / high / mobile tiers + low-FPS AO watchdog)
      ├── src/renderer.js      (WebGLRenderer, cached PCFSoftShadowMap, pmndrs/postprocessing + N8AO + DoF)
      ├── src/materials.js     (procedural PBR normal/roughness/albedo generators + shared materials)
      ├── src/lighting.js      (warm PMREM IBL, sun shadow rig, RectAreaLight, Golden Hour <-> Rainy Dusk)
      ├── src/room.js          (PBR oak plank floor, woven rug, walls w/ window cutout, trim, 4-panel door)
      ├── src/exterior.js      (3D parallax outdoor world: GLSL sky dome, ridge arcs, wind pines, birds, rain, sunbeams)
      ├── src/window-nook.js   (mullioned window, physical glass + GLSL rain droplets, curtains, sill mood switch, bench, curio towers)
      ├── src/props.js         (succulents, potted plants, wax candles w/ flames, vases, stacks, prints, sculptures)
      ├── src/books.js         (bookcase carpentry, RoundedBoxGeometry books, spine/cover textures, Open Library, lever, cover arc)
      ├── src/tables.js        (reading table, brass lamp, cover-up reading books + silk bookmarks)
      ├── src/guestbook.js     (guest table, picture ledges, leather ledger, inkwell/quill, Worker POST, GitHub Issues sync)
      ├── src/turntable.js     (credenza, LP sleeves, anisotropic vinyl disc, metallic platter, solved tonearm, dust cover)
      ├── src/gallery.js       (right-wall 7-poster salon in 3-over-4 grid w/ beveled oak frames, matboards & museum glass)
      ├── src/audio.js         (HRTF spatialized synth LP, Rainy Dusk window audio, surface-aware footsteps & foley)
      └── src/controls.js      (PointerLock + WASD, touch drag + virtual stick + tap raycast, AABB collisions, focus-safe head-bob)
```

### Why Zero-Build Native ES Modules?
- **Instant local dev & static hosting:** Works directly with `python3 -m http.server`
  and GitHub Pages without Node build pipelines, Vite, or Rollup artifacts.
- **Clean separation of concerns:** Replaces a 4,113-line single `<script>` tag
  with 16 cohesive modules (~70–550 lines each) so humans and AI agents can
  inspect or modify any subsystem (e.g. `exterior.js` or `audio.js`) in isolation.

---

## 2. Scene Graph & Real-World Scale

All units are real-world metres (`ROOM = { w: 7, d: 6.4, h: 2.9 }`, `EYE = 1.62`):

```
THREE.Scene (environment = warm PMREM interior texture, Fog)
├── Lighting (`src/lighting.js`)
│   ├── ambient (AmbientLight) + hemi (HemisphereLight)
│   ├── sun (DirectionalLight, PCFSoftShadowMap, shadow.autoUpdate = false)
│   ├── fill (DirectionalLight)
│   ├── windowArea (RectAreaLight spanning landscape window opening)
│   └── practicals: lampLight, playerLight, sconceNorth, sconceSouth, shelfGlow, guestGlow
├── Room Shell (`src/room.js`)
│   ├── floor (wide-plank oak PBR: albedo + normal + per-plank roughness)
│   ├── rug (woven wool center rug w/ geometric border, RUG_BOUNDS)
│   ├── ceiling + back/front/right walls + 4-piece left wall framing window cutout
│   ├── perimeter baseboards + crown molding
│   └── doorGroup (front wall +Z at x = -1.9, 4 recessed panels, brass lever, threshold glow)
├── 3D Parallax Exterior (`src/exterior.js`, outside -X window)
│   ├── skyDome (r = 28 m BackSide sphere at eye height; GLSL Golden Hour <-> Rainy Dusk,
│   │   sun + clouds driven by view elevation/azimuth)
│   ├── 4 mountain ridge arcs (r = 4.6 / 8.2 / 13 / 18.5 m, ±78° around the window;
│   │   painterly ShaderMaterial: sun-lit crests/slopes, base shadow, brush noise, aerial haze)
│   │   + valley mist arc (open cylinder segment, r = 9.5 m)
│   ├── 6 wind-swaying 3D pine trees
│   ├── 5-bird 3D flock (Golden Hour) + 260 falling 3D rain streaks (Rainy Dusk)
│   └── indoor volumetric sunbeams (AdditiveBlending)
├── Built-in Book Nook (`src/window-nook.js`, left wall -X, rotated +π/2)
│   ├── physical glass pane + GLSL animated rain-droplet & corner-mist shader
│   ├── beveled oak frame & mullions + sheer breathing linen curtains
│   ├── moodSwitch (interactive brass toggle on right window sill)
│   ├── bench w/ 3 drawers, tufted physical-sheen linen cushion, 4 pillows, ceramic mug
│   └── north & south curio towers (4 shelves each, cabinets, brass sconces, curated curios)
├── Bookcase & Wall Lever (`src/books.js`, back wall -Z)
│   ├── beveled oak bookcase (dimmable `caseWood`/`caseWoodDark` clones)
│   ├── finished books (`RoundedBoxGeometry(th, h, depth)`) on lower 3 shelves
│   ├── decorGroup (succulents, wax candles w/ flames, flat stacks, typography prints, vases)
│   └── wallSwitch (framed plaque + brass clevis & wooden-grip lever)
├── Reading Table (`src/tables.js`, left of bookcase)
│   ├── beveled oak table, brass reading lamp, ceramic succulent
│   └── cover-up `reading` books + burgundy silk ribbon bookmarks
├── Guest Table & Wall Ledges (`src/guestbook.js`, front wall +Z right of door, rotated π)
│   ├── beveled oak table + 2 wall picture ledges (`GUEST_LEDGE`, hidden when empty)
│   ├── embossed leather ledger (`ledgerBlocks` open smoothly on hover/modal)
│   ├── refractive dark-glass inkwell + brass collar + animated quill
│   ├── standing framed sign + dashed ghost book slot
│   └── shelved & local-pending 3D guest books + bobbing "awaiting approval" tags
├── Hero Turntable (`src/turntable.js`, right wall +X, rotated -π/2)
│   ├── walnut/oak credenza + 12 leaning LP sleeves
│   └── plinth, brass feet, metal platter, felt mat, anisotropic micro-groove LP, tonearm, dust cover
└── Salon Gallery Wall (`src/gallery.js`, right wall +X above credenza)
    └── 7 vintage reading posters (`./posters/*.jpg`) in 3-over-4 grid w/ oak frames, matboards & glass
```

---

## 3. Rendering, Shadows & Post-Processing Pipeline

### Merged Post-Processing (`src/renderer.js`)
Uses `pmndrs/postprocessing` (`HalfFloatType` HDR framebuffer) instead of
legacy Three.js `examples/jsm/postprocessing` separate full-screen passes:

```
RenderPass(scene, camera)
  ──► N8AOPostPass (half-res contact AO in shelf corners, book gaps & baseboards)
  ──► EffectPass(DepthOfFieldEffect) [enabled dynamically only when inspecting a book]
  ──► EffectPass(BloomEffect[mipmapBlur], VignetteEffect, ToneMappingEffect[AGX], SMAAEffect)
```

- **AgX Tone Mapping (`ToneMappingMode.AGX`):** Preserves warm highlights on
  brass, lamp shades, and sunlit oak planks without ugly yellow/orange clipping.
- **Cached Soft Shadows (`PCFSoftShadowMap`):** `renderer.shadowMap.autoUpdate`
  is set to `false`. A shadow pass only runs when `runtime.shadowsDirty = true`
  (initial boot, mood transition, quality change, or book movement). Steady-state
  walking renders **zero shadow passes per frame**.

### Dual Mood System (`golden` ↔ `rain`)
`runtime.moodT` smoothly damps between `0` (Golden Hour) and `1` (Cozy Rainy Dusk):
- **Exterior (`exterior.js` & `window-nook.js`):** Sky shader transitions from
  warm amber sun halo to deep twilight blue; ridge shaders (`uMood`) lose
  their warm crest light and shift cool; foliage shifts cool;
  birds and sunbeams fade out while 3D rain streaks and GLSL
  window-pane trickling droplets fade in.
- **Interior (`lighting.js`):** Directional sun dims and cools while practical
  warm indoor point lights (`lampLight`, `playerLight`, `sconceNorth/South`,
  `shelfGlow`, `guestGlow`), lamp shade emissive, and flickering candle flames
  illuminate the study.
- **Audio (`audio.js`):** Spatialized pink-noise rain patter outside the
  window smoothly fades in via `rainGain`.

---

## 4. Book Mesh Orientation & Cover Exhibition Invariants

Every book mesh uses `RoundedBoxGeometry(b.th, b.h, depth)` with Three.js
6-material face order:

```
[coverMat (+x), backMat (-x), PAGE_BLOCK_MAT (+y), PAGE_BLOCK_MAT (-y), spineMat (+z), PAGE_BLOCK_MAT (-z)]
```

- **Standing on Bookcase (`rotation.y = 0`):** `+z` (spine) faces the room (`+Z`).
- **Cover Exhibition Arc (`rotation.y = -Math.PI / 2 - theta`):** `+x` (front
  jacket) faces the viewer along a shallow 3.15 m arc (`people` top, `other`
  second, `fiction` third, `Harry Potter` bottom).
- **Lying on Reading / Guest Tables:** `mesh.rotation.z = -Math.PI / 2` inside
  a `wrap` group (`wrap.rotation.y ≈ Math.PI / 2 ± jitter`) so `+x` (front
  cover) faces straight up (`+Y`) and `+z` (spine) faces left. Pulling a table
  book lifts `wrap` in `Y`/`Z` and tilts `mesh.rotation.x` toward the viewer.

---

## 5. Spatial Audio & Foley Graph (`src/audio.js`)

```
Synth Pads + Plucks + Slapback Delay + Vinyl Crackle
  ──► musicBus (GainNode)
  ──► panner (HRTF PannerNode at turntable worldPos) ──┐
                                                       ├──► master ──► ctx.destination
Pink-Noise Rain Loop ──► Lowpass (1150 Hz)             │
  ──► rainGain (tracks moodT)                          │
  ──► rainPanner (HRTF PannerNode at window opening) ──┤
                                                       │
Procedural Foley (oak/rug footsteps, book slide, click)┘
```

- Every scheduled `OscillatorNode` registers an `onended` handler to delete
  itself from `activeVoices` (`Set`), preventing oscillator memory accumulation.
- `AudioContext` is lazily created on the first user gesture (`enterRoom()`).

---

## 6. Adaptive Quality Tiers (`src/quality.js`)

| Tier | Default On | Max DPR | Cached Soft Shadows | `N8AO` Contact AO | SMAA |
| --- | --- | --- | --- | --- | --- |
| `ultra` | Manual toggle | `2.0` | `2048²` | Full-res | Yes |
| `high` | Desktop | `1.75` | `1536²` | Half-res | Yes |
| `mobile` (`Fast`) | Touch / Mobile | `1.25` | Off | Off | Off |

`monitorPerformance()` samples 2-second windows while `runtime.inRoom` is true;
if sustained FPS drops below 43 for two consecutive windows, it steps `ultra`
down to `high`, or disables `aoEnabled` on `high`.
