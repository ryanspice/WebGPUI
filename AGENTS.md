# WebGPUI agent contract

Read [README.md](README.md), [TESTING.md](TESTING.md), and
[docs/GPUI-WEB-SDK.md](docs/GPUI-WEB-SDK.md) before changing code; then read the
relevant facade source under `gpui-sites/`. Preserve the owner's explicit
instructions and any more specific repository rules.

## Engineering

- The P0 CDN facade is **Svelte-first** over the real `gpui-native` WASM/WebGL2 (default)
  renderer. Keep React out of `gpui-sites/sdk.mjs` and the P0 bundle; React and
  Vue are opt-in upstream renderers, not part of the CDN entry.
- Version is `0.3.1`. Keep `sdk.mjs`, `llms.txt`, `manifest.json`, docs and tests
  consistent when it changes.
- Upstream JS/TS fixes live in
  `gpui-sites/patches/upstream-host-and-compiler.patch`; `Build-WebGPUI.ps1`
  applies it with `git apply --check` and fails on revision drift. Update the
  patch deliberately, never silently.
- Prefer targeted edits, existing conventions and minimal dependencies. Do not
  add a second homepage source or duplicate the LLM guide.

## Verification

Follow [TESTING.md](TESTING.md) for test selection and evidence limits. Source
changes need `python -m pytest tests/test_gpui_sdk.py -q`; demo/visual changes
also need a real-browser paint and interaction check. A canvas appearing alone
is not proof of rendering. Never claim Windows, GPU, network or deployment
verification that was not performed.

## Handoff

State what changed, why, which checks ran and what remains unverified.
Publication, deployment, rollback and retirement require separate owner
authorization. Keep recovery copies; do not delete unrelated work.
