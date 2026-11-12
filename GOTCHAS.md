# Gotchas

Bugs and subtle invariants discovered across v1 and v2. Read before touching
movement, import maps, book geometry, post-processing, or audio.

---

## 1. `n8ao` requires `"three/examples/jsm/"` in the import map (v2)

**Symptom:** Page halts on `Failed to start: TypeError: Failed to resolve module specifier "three/examples/jsm/postprocessing/Pass.js"`.

**Cause:** Our own v2 modules import Three addons via `"three/addons/..."`,
which is the modern Three.js convention. However, `n8ao@1.9.4` internally
imports `Pass.js` using the older `"three/examples/jsm/postprocessing/Pass.js"`
specifier.

**Fix:** Always include **both** prefix mappings in `reading-room.html`:
```json
"three/addons/": "https://esm.sh/three@0.172.0/examples/jsm/",
"three/examples/jsm/": "https://esm.sh/three@0.172.0/examples/jsm/"
```

---

## 2. Book `BoxGeometry` axis convention (`th, h, depth` vs `depth, h, th`) (v2)

**Symptom:** In Cover Exhibition Mode, books turn sideways showing thin spines
instead of front covers; on tables, books show cream page blocks on top instead
of their cover art.

**Cause:** `makeBookMaterials()` assigns `[coverMat (+x), backMat (-x), page (+y), page (-y), spineMat (+z), page (-z)]`.
If geometry is built as `(depth, h, th)` instead of `(th, h, depth)`, `+x` is
only `th` (~2 cm) wide and `+z` is `depth` (~15 cm) wide — swapping the spine
and cover aspect ratios and orientations by 90°.

**Fix:** Always construct book geometry as `RoundedBoxGeometry(b.th, b.h, depth)`:
- Shelf rest: `rotation.y = 0` (`+z` spine faces room).
- Cover arc: `rotation.y = -Math.PI / 2 - theta` (`+x` cover faces room).
- Table flat: `mesh.rotation.z = -Math.PI / 2` inside `wrap` (`+x` cover faces `+Y` up).

---

## 3. JavaScript `0` is falsy when checking `rowIndex[b.row]` (v2)

**Symptom:** Books with `row: 'people'` (`rowIndex.people === 0`) get duplicated
onto the bottom `fiction` shelf when filtering fallback rows with `!rowIndex[b.row]`.

**Cause:** `!0 === true` in JavaScript, so `!rowIndex['people']` evaluates to `true`.

**Fix:** Always check key membership with `!(b.row in rowIndex)` instead of `!rowIndex[b.row]`.

---

## 4. NaN from `Number(undefined)` permanently breaks movement (v1 & v2)

**Symptom:** Player freezes or camera teleports after pressing certain keys.

**Cause:** `keys[e.code]` is `undefined` for keys never pressed. `Number(undefined)`
produces `NaN`, poisoning `velocity` and `camera.position` forever.

**Fix:** Use explicit ternaries (`keys.KeyW ? 1 : 0`) and keep the
`Number.isFinite(camera.position.x)` guard in `src/controls.js`.

---

## 5. `EffectComposer` pixel ratio & renderer toneMapping double-application (v1 & v2)

**Symptom:** Soft half-res rendering if composer DPR isn't synced, or washed-out/clipped
colors if both `WebGLRenderer.toneMapping` and `pmndrs/postprocessing`
`ToneMappingEffect` run simultaneously.

**Fix (`src/renderer.js`):**
- Sync `renderer.setPixelRatio(dpr)`, `renderer.setSize(w, h)`, and
  `composer.setSize(w, h)` on init, quality changes, `resize`, and `visualViewport` resize.
- Keep `renderer.toneMapping = THREE.NoToneMapping` whenever `SETTINGS.effects`
  is `true` (since `ToneMappingEffect(AGX)` handles tone mapping inside the
  merged `EffectPass`), and switch to `THREE.AgXToneMapping` only when
  rendering raw (`SETTINGS.effects = false`).

---

## 6. Realtime shadows tank FPS unless `shadow.autoUpdate = false` (v2)

**Symptom:** Re-rendering a 1536²–2048² shadow map across 100+ book and prop
meshes every single frame wastes GPU vertex throughput even when nothing in
the room is moving.

**Fix:** Keep `renderer.shadowMap.autoUpdate = false` in `src/renderer.js` and
set `runtime.shadowsDirty = true` only when lighting mood (`moodT`), quality
tier, cover-exhibition mode (`coverT`), or book pull (`u.pull`) actually changes.

---

## 7. `SETTINGS` mismatch & `voices[]` oscillator leak from v1 (resolved in v2)

- **`SETTINGS` single source of truth (`src/state.js`):** In v1, hardcoded light
  colors/intensities drifted from `SETTINGS`, making `?edit=1` sliders lie on
  open. In v2, `lighting.js` and `renderer.js` read directly from `SETTINGS` at
  boot and on every mood tick.
- **Oscillator cleanup (`src/audio.js`):** In v1, every synth chord/pluck pushed
  `OscillatorNode`s into `voices = []` without ever removing ended nodes. In v2,
  `activeVoices` is a `Set` cleaned automatically via `osc.onended = () => activeVoices.delete(osc)`.

---

## 8. Tonearm solved geometry (`src/constants.js` & `src/turntable.js`)

Do not eyeball tonearm angles — keep the solved constants:
- `ARM_PARK = 0.404` (clears platter)
- `ARM_OUTER = -0.459` (outer groove)
- `ARM_INNER = -0.710` (inner run-out before label)

## 9. Table books: front cover up, spine left, gentle lift

Reading-table and guest-table books use `mesh.rotation.z = +π/2` (puts the
`+x` front-cover face, `material[0]`, on top) with wrap yaw `-π/2 + jitter`
so the top of the book points away from the viewer and the jacket reads
upright with the spine on the left. Using `-π/2` puts the jacket face-down;
copying it onto `material[1]` hides that but mirrors the spine to the right.
On hover they only lift (`+0.08 y`, `+0.06 z`, like v1) — no roll, or the
book tips onto its spine edge and floats.

Remote `cover` URLs (guest Open Library ids) need `crossOrigin = 'anonymous'`
or WebGL rejects the image ("contains cross-origin data") and it renders black.

## 10. NaN pixels become black rectangles

The composer uses a HalfFloat buffer and mipmap bloom, which smears any
NaN/Inf pixel into flickering black blocks (in every tier, since bloom stays
on in Fast). In custom GLSL never `pow()` a value that can go negative — clamp
first (see sunbeam shader in `exterior.js`).

## 11. Inspect pose: book glides to the camera

Clicking any book (shelf, cover mode, reading/guest table, ledge) blends its
world pose toward a spot `INSPECT.dist` in front of the camera (`applyInspect`
in `src/main.js`, driven by `userData.insp`). The rest pose is recomputed every
frame first, so:
- shelf books must reset `rotation.x` (the blend writes a full quaternion);
- table/ledge meshes restore `userData.restLocal` before blending.
Held books drop `castShadow` so the cached shadow map never keeps a stale
shadow of a book floating in front of you. DoF focuses on the mesh itself.
`inspectFit()` keeps the default pose when the book is on screen and clear of
the drawer (desktop); otherwise it centres it in the largest free region and
backs off to fit (phones, where the drawer is a full-width bottom bar). One
rule, no device branch; test "clear of the drawer", not "inside a region", or a
tall book beside the desktop drawer gets moved needlessly.

## 12. Exterior sky dome: radius vs camera far plane, and colour space

The view through the book-nook window is a pocket world inside a BackSide sky
dome (`src/exterior.js`), centred at eye height just outside the window. Its
radius (28 m) plus the farthest camera spot in the room (~9.5 m from the
window) must stay under `camera.far` (42 m in `src/renderer.js`), or the far
plane clips the sky and the window shows the flat `scene.background` again.
Ridges and mist are arcs (±78°) around the same centre so oblique views never
reach a ridge end; `scene.background` just follows the fog colour now.

Exterior shaders author colours in sRGB and end with
`pow(max(col, 0.0), vec3(2.2))`: the HDR pipeline expects linear values and
without the conversion the sky reads pale grey. Clamp before the `pow()` (see
#10). The sun disc is *added* on top of its glow, never mixed, so it stays the
brightest thing in the sky.

## 13. Exterior forest is forced perspective

The pocket world outside the window is tiny: ridges sit only 4.6–18.5 m away
and are 2.5–6.2 m tall. Pines are scaled to the ridges (~0.45–1.25 m), not
to real trees, or they read as giants. They are planted with the same
`ridgeTop()` profile that builds the ridge strips (rooted just below the
crest, just in front of the strip). Change a ridge profile and the trees follow;
place trees by hand and they float. Instance colours are rewritten only when
`runtime.moodT` changes. Don't move that into the per-frame path.
