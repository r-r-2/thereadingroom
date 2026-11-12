# The Reading Room v2 — Architecture & Modernization Roadmap

> **Branch / Worktree:** `feat/room-v2` in `../thereadingroom-v2` (while `main` remains in `../thereadingroom`).
> **Nostalgia Preservation:** The original stylized single-file 2025 room is preserved verbatim at **`v1.html`**, sharing `./books.js` and `./guestbook.js` so new books and shelved guest recommendations automatically appear in **both** v1 and v2.

---

## Vision & Architectural Decisions (ADRs)

1. **Zero-Build Native ES Modules (`src/*.js`):**
   - Keeps the zero-bundler workflow (`python3 -m http.server` + GitHub Pages static deploy) while splitting the 4,100-line monolith into focused, maintainable ES modules.
   - Uses an import map with Three.js `0.172.0` + `postprocessing@6.36.6` + `n8ao@1.9.4` for modern AgX tone mapping, merged shader post-processing, and half-res screen-space ambient occlusion.

2. **Nostalgia Time Capsule (`v1.html`):**
   - `v1.html` is the frozen single-file stylized Lambertian room (`reading-room.html` at commit `a4140ae`), linked from v2's entry gate and quick-settings HUD (*"Visit v1 (2025)"*), with a reciprocal *"Step into v2 →"* link on `v1.html`.
   - Both `reading-room.html` (v2) and `v1.html` import `./books.js` and `./guestbook.js`. Never fork the data files.

3. **Physically Based Rendering (PBR) + Cached Soft Shadows:**
   - Replace diffuse-only `MeshLambertMaterial` with `MeshStandardMaterial` and `MeshPhysicalMaterial` (roughness, metalness, fabric sheen, clearcoat, glass transmission/reflectivity) grounded by a warm interior IBL environment (`PMREMGenerator`).
   - Use `PCFSoftShadowMap` on the directional sun light with **`shadow.autoUpdate = false`** (rendered on load, mood changes, and book cover-mode transitions) so real window-mullion and furniture shadows cost ~0 ms per frame during normal walking.

4. **Dual Mood System (`golden` ↔ `rain`):**
   - **Golden Hour (default):** Low-angle warm sunlight streaming through the left-wall book nook, bright valley haze, dappled floor shadows.
   - **Cozy Rainy Dusk:** Deep blue twilight outside, animated rain droplets trickling down physical window glass, soft rain patter audio, and **indoor warm practical lights turning ON** (reading table lamp, brass nook sconces, turntable corner light, gallery wash, and flickering wax candles).
   - Toggleable from the HUD quick-bar (`M` shortcut) or a physical brass mood switch on the book-nook sill.

5. **Adaptive Performance Tiers (`ultra` / `high` / `mobile`):**
   - Desktop defaults to `high`/`ultra` (PBR + IBL + cached soft shadows + half-res `N8AO` + Mipmap Bloom + SMAA).
   - Touch/mobile defaults to `mobile` (1.25 DPR cap, PBR + IBL + Bloom, skips screen-space AO and heavy shadow maps) and includes an automatic frame-time watchdog that steps down AO if sustained FPS drops below 45.

6. **Subtle, Toggleable First-Person Presence:**
   - Footstep-synced gentle figure-8 head-bob (~8 mm vertical, zero roll) + 1.5 mm idle breathing, **automatically damped to zero** whenever aiming at an interactable or inspecting a book, and respecting `prefers-reduced-motion` + a user HUD toggle.

---

## Phased Execution Status

### [x] Phase 0 — Git Worktree, `v1.html` Time Capsule & Agent Docs
- [x] Create sibling worktree `../thereadingroom-v2` on branch `feat/room-v2`.
- [x] Preserve original `reading-room.html` as `v1.html` sharing `./books.js` and `./guestbook.js`, with cross-links between v1 and v2.
- [x] Create `PLAN.md` and update `AGENTS.md`, `ARCHITECTURE.md`, and `GOTCHAS.md` so any future AI agent or contributor can pick up seamlessly.

### [x] Phase 1 — Modular Engine, Next-Gen Render Pipeline & Dual Mood System
- [x] Split `reading-room.html` into clean `src/` ES modules (`constants.js`, `state.js`, `quality.js`, `materials.js`, `lighting.js`, `renderer.js`, `room.js`, `window-nook.js`, `bookcase.js`, `decor.js`, `tables.js`, `guestbook.js`, `turntable.js`, `gallery.js`, `audio.js`, `controls.js`, `ui.js`, `main.js`).
- [x] Bump Three.js to `0.172.0` + `postprocessing` (`EffectComposer`, `BloomEffect`, `VignetteEffect`, `ToneMappingEffect` in `AGX` mode, `SMAAEffect`) + `N8AOPostPass` (half-res contact shadows).
- [x] Warm studio/interior IBL environment via `PMREMGenerator` + `RectAreaLightUniformsLib` window & shelf area lights + cached `PCFSoftShadowMap` directional sun.
- [x] Eliminate legacy dead `intensity: 0` zombie lights and stale `SETTINGS` mismatches; fix `Music` `voices[]` oscillator array leak.
- [x] Implement **Golden Hour ↔ Cozy Rainy Dusk** live transition system (sky/exterior palette, indoor lamp/sconce/candle practical lights, HUD pill + `M` key + window-sill switch) and toggleable subtle head-bob (`B` key / HUD pill).

### [x] Phase 2 — PBR Architecture, Beveled Carpentry, Gallery Salon & 3D Parallax Exterior
- [x] Real PBR surface maps (wide-plank oak albedo/normal/roughness, limewash plaster micro-bump, woven center area rug, `MeshPhysicalMaterial` linen/velvet sheen on nook cushion & pillows).
- [x] Architectural trim (baseboards, crown molding, hallway light sliver under paneled door) + `RoundedBoxGeometry` chamfers across bookcase, tables, curio towers, and credenza.
- [x] Right-wall 7-poster salon upgraded with beveled oak frames, recessed cream matboards, and reflective museum-glass panes.
- [x] Replace 2D CPU canvas window with **3D parallax outdoor pocket world** (sky scattering, 3D mountain ridges, GPU wind-swaying pines, 3D bird flock, sheer breathing curtains, physical glass with animated rain droplets in Rainy Dusk mode, sunbeams).

### [x] Phase 3 — Tactile Books, Hero Turntable, Curios & Guest Table
- [x] Tactile book geometry (`RoundedBoxGeometry` chamfers, paper-edge striation texture, cloth spine gradient, jacket clearcoat).
- [x] Hero turntable upgrade (anisotropic radial micro-groove vinyl shader, metallic platter/spindle, brushed tonearm, amber status LED, acrylic dust cover).
- [x] Curio towers, subsurface-scattering wax candles with Rainy Dusk flicker, glowing warm lamp shades/sconces, refractive dark-glass inkwell + feathered quill.

### [x] Phase 4 — First-Person Game Juice, Inspection DoF & Spatial Foley
- [x] Depth-of-Field (`DepthOfFieldEffect`) rack-focus blur when pulling a book out to inspect.
- [x] HRTF 3D spatialized turntable audio (`PannerNode`), spatialized Rainy Dusk window bed, and procedural foley (oak vs. rug footsteps synced to head-bob, book paper slide, brass switch click).
