# Gotchas

Bugs that cost real time. Each entry explains the symptom, the root cause,
and how it was fixed.

---

## 1. NaN from `Number(undefined)` permanently broke movement

**Symptom:** Player could no longer move after pressing certain keys. Camera
position was frozen or drifting.

**Cause:** The keyboard state map uses `keys[e.code] = true/false`. A key
that has never been pressed has value `undefined`. Reading it with `Number()`
returns `NaN`, which propagates into the direction vector, then into velocity,
then into `camera.position`. Once NaN is in the position, it never clears
because every subsequent arithmetic produces NaN.

**Fix:** Explicit ternaries everywhere:
```js
const fwd = (keys['KeyW'] || keys['ArrowUp']) ? 1 : 0;
```
Never `Number(keys[code])`. A `Number.isFinite` guard in the loop resets
velocity as a backstop:
```js
if (!Number.isFinite(velocity.x) || !Number.isFinite(velocity.z)) velocity.set(0, 0, 0);
```

---

## 2. `EffectComposer` rendered at half resolution

**Symptom:** The whole image looked soft and blurry, as if upscaled from a
lower resolution. Bloom was blocky.

**Cause:** `EffectComposer` creates its own render target and does not
inherit the renderer's pixel ratio. Without an explicit call, the composer
renders at CSS pixel resolution (1×) while the canvas is drawn at device
pixel ratio (2× on most displays).

**Fix:**
```js
composer.setPixelRatio(Math.min(devicePixelRatio, 2));
```
Must also be called in the `resize` handler.

---

## 3. `const interactables` threw a TDZ ReferenceError

**Symptom:** Page sat on "Building the room…" text with nothing obviously
wrong in the console.

**Cause:** `const` is not hoisted (temporal dead zone). `interactables` was
originally declared below `placeBooks()`, but `placeBooks()` runs at module
scope and pushes into `interactables` immediately. The reference was read
before the declaration was evaluated.

**Fix:** Declare `interactables` before `placeBooks()` runs. Its current
position (after the book-material helpers but before the function call) is
correct.

A global `error` handler was added to surface the message when the module
throws:
```js
addEventListener('error', (e) => {
  const el = document.getElementById('loading');
  if (el) el.textContent = 'Failed to start: ' + (e.message || 'unknown error');
});
```

---

## 4. Tonearm angles placed the stylus outside the record

**Symptom:** The headshell hung visibly past the edge of the record.

**Cause:** Angles were guessed and eyeballed. The pivot is 0.247 m from the
record centre; the arm is 0.228 m long. The original `+0.12` angle put the
stylus 0.256 m from the centre — past the 0.148 m record edge.

**Fix:** Solve against the geometry. Current angles:
- `ARM_PARK = 0.404` — clears the platter
- `ARM_OUTER = −0.459` — stylus at r = 0.132 m (just inside the groove area)
- `ARM_INNER = −0.710` — stylus at r = 0.075 m (just outside the label)

---

## 5. Bloom blew out the room when combined with emissive geometry

**Symptom:** After adding any emissive surface, the whole room became
washed out and overexposed.

**Cause:** `MeshBasicMaterial` surfaces (which ignore lighting and appear
emissive) and the bloom pass interact: the basic-material surface is already
bright, bloom amplifies it, which raises the overall brightness, which
lowers perceived contrast everywhere.

**Fix:** Tune emissive intensity and bloom threshold together, not separately.
The current bloom threshold of 0.90 means only the very brightest points
(candle flames) glow. If you add a new emissive surface, lower its brightness
first, then adjust bloom threshold.

---

## 6. `SETTINGS` values do not match scene initialisation

**Symptom:** Opening the lil-gui panel immediately after page load shows
slider values that do not reflect what the scene was actually built with.
"Copy settings" at launch gives stale numbers.

**Cause:** The scene objects are hardcoded with one set of values, and
`SETTINGS` (the object the GUI reads from) was updated at different times.
Current mismatches:

| SETTINGS key | SETTINGS value | Actual scene init |
|---|---|---|
| ambientIntensity | 0.5 | 0.62 |
| ambientColor | `#ffeedd` | `0xffeaCF` |
| keyIntensity | 22 | 19 |
| keyColor | `#ffcb8a` | `0xffc078` |
| fillIntensity | 9 | 7 |
| fillColor | `#9fc4e8` (cool blue) | `0xd8cbb4` (warm beige) |
| washColor | `#ffe0b0` | `0xffd9a0` |
| fogNear | 6 | 7 |
| fogFar | 15 | 17 |

The fill colour mismatch is the most significant: the GUI colour picker
starts at a cool blue, but the actual fill light is warm.

**Fix:** Either initialise scene objects from `SETTINGS` values (so there is
one source of truth), or update `SETTINGS` to match current hardcoded values.

---

## 7. `voices` array accumulates indefinitely

**Symptom:** Not yet observable, but the `voices` array in the `Music` IIFE
grows without bound across the lifetime of the page.

**Cause:** Every `pad()` call pushes 4 oscillator nodes; every `pluck()` call
pushes 1. The oscillators stop after their scheduled time, but they are never
removed from `voices`. `stop()` clears `timers` but does not clear `voices`.
At 9.5 s per chord over a 7-minute side, that's ~44 chords × 4 pad + ~110
pluck = ~286 oscillator references held in memory after they've finished.

**Fix:** Splice each oscillator out of `voices` in its `onended` handler:
```js
o.onended = () => voices.splice(voices.indexOf(o), 1);
```
Or clear `voices` inside `stop()` after cancelling oscillators. The array
is also never actually read anywhere, which suggests the original intent was
to be able to stop all active oscillators on `stop()` — that logic was never
finished.

---

## 8. Dead `SPEED` constant (resolved)

`const SPEED = 22;` used to sit unused next to `SETTINGS.moveSpeed`. It was
removed when movement switched to wish-velocity smoothing (`moveSpeed` is
now max speed in m/s, default `2.4`).
