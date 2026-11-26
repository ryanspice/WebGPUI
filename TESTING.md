# WebGPUI testing guide

Read with [AGENTS.md](AGENTS.md) and [README.md](README.md). This guide governs
verification choices; it grants no release, deployment or filesystem authority.
Use the shared `S:\OneDrive\Obsidan\AI-Wiki\TESTING.md` for deeper guidance when
available; this local contract is sufficient without it.

## Verification contract

Protect a credible behavior or contract failure with the smallest sufficient
check against the real implementation. Reuse valid evidence, add tests for real
gaps, and stop once relevant checks pass. Preserve first failures; do not weaken
assertions, auto-approve baselines, or equate a mock with live integration.
Distinguish source inspection, static checks, build, browser execution and human
acceptance.

## Existing runners

Run from the repository root (PowerShell):

```powershell
python -m pytest tests/test_gpui_sdk.py -q
# Full reproducible build (applies the pinned upstream patch):
pwsh -NoProfile -File .\Build-WebGPUI.ps1
```

Check `$LASTEXITCODE` after native commands; record or stop on failure. The
static suite guards the exported surface, version strings, demo import URLs,
patch wiring and agent-guide contract. It does not compile WASM.

## Browser verification

For demo or facade changes, serve `dist-sites/` with correct MIME (`.mjs` →
`text/javascript`, `.wasm` → `application/wasm`) and use a real browser. The
self-validating demos expose `window.__root`:

- wait for the root and first native paint; wait ~1s for layout before reading
  automation bounds;
- `getPaintedText()` must contain the expected strings and must not contain
  `"Application runtime error"`;
- drive a button with `simulateClick` from `getAutomationTree()` bounds and
  assert a painted-text delta; for inputs, wait a frame after `focusElement()`
  before `simulateKeystrokes()` (it is a keystroke parser, not text insertion);
- repeat after resize and require zero page errors.

A canvas, a `ready` status, or a non-empty painted array alone is not success.
Input text appears twice in painted text; `getAllText()` omits it.

## Release evidence

Before publishing, verify the emitted tree, hashes, MIME/CORS/cache headers,
404 behavior and the live demos. Keep a recovery copy of the replaced remote
directory and record a receipt outside the web root. Deployment is a separate
authorized operation.
