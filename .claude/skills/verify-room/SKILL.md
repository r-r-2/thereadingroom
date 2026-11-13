---
name: verify-room
description: Run The Reading Room's headless verification after a change or rewrite. `check` (default) asserts console-clean, table covers, face-up/spine-left books, hover lift, Q/M/C keys, no NaN black blocks, gate copy, v1 link. `visual [ref]` writes a before/after screenshot page for the developer to review.
---

# /verify-room

Arguments: none or `check` → check mode. `visual` or `visual <git-ref>` → visual mode (default ref `main`). `all` → both.

## Run

```bash
cd tools/verify && [ -d node_modules ] || npm install --silent
node verify.mjs check            # ~1.5 min
node verify.mjs visual main      # ~1 min
```

The script serves the repo itself on a random port, so it doesn't need `python3 -m http.server`. It uses the local Google Chrome (`CHROME_PATH` overrides).

## Token rules (important)

- **Check mode:** read only the script's stdout. It's one line per FAIL/WARN plus a summary. Open `tools/verify/out/check.log` only if a FAIL needs more context, and then read only the relevant entry.
- **Visual mode:** do **not** open or describe the screenshots. Give the user the absolute path to `tools/verify/out/visual/index.html` and say "open it to compare". The developer reviews before/after; Claude doesn't (deferred until image review is cheaper).
- Don't paste the full output back. Report:
  - pass/fail counts;
  - each FAIL in one plain sentence;
  - for each FAIL, the likely file, using `GOTCHAS.md` (#9 table books, #10 NaN black blocks).

## What check mode asserts

| Check | Guards against |
| --- | --- |
| console-clean (HTTP ≥400 with URL, page errors, console errors) | shader errors, WebGL cross-origin texture errors, missing files |
| table-book covers | remote `cover` URL loaded without CORS (black jackets) |
| face-up / spine-left / upright | table books lying cover-down or mirrored |
| table-hover | hovered table book rolling onto its spine or flying off |
| key-q / key-m / key-c | quality / mood / cover-mode shortcuts |
| no-black-blocks | NaN pixels smeared into black squares by bloom |
| gate-copy, gate-v1-link, v1-loads | v1-voice intro, "older v1" link, v1.html still works |

Ignored as noise: `favicon.ico`, Open Library `?default=false` 404s (the designed "no cover" fallback).

## When adding a check

Add it to `check()` in `tools/verify/verify.mjs` with `pass/fail/warn`. Keep its failure message to one line that names the book or view. Then confirm the check actually fails: temporarily reintroduce the bug, run, and restore.
