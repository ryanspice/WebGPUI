# WebGPUI

**WebGPUI v0.2.0** is a small, CDN-first Web SDK over the real upstream
`gpui-native` Rust/WebAssembly renderer. It paints genuine GPU-composited GPUI
UI in a browser canvas — it is **not** React DOM, an HTML/CSS imitation, or a
canvas mockup.

- Runtime: upstream Svelte 5 adapter (`@gpui-native/svelte` 5.57.0) → WebGPU/WASM.
- P0 facade: one ES module, no build step, **zero React** in the dependency graph.
- React and Vue remain supported opt-in custom renderers in the upstream SDK;
  they are not bundled into the CDN entry.

## Quick start

```html
<script type="module">
  const { mount, ui } = await import(
    'https://ryanspice.com/dev/gpui/v1/gpui.mjs?v=0.2.0'
  );
  await mount({
    initialState: { count: 0 },
    view: (state, update) => ui.column({ style: { padding: 24, gap: 12 } }, [
      ui.text('Count: ' + state.count),
      ui.button('+', () => update({ count: state.count + 1 }))
    ])
  });
</script>
```

Live demos: [game HUD](https://ryanspice.com/dev/gpui/examples/game/) ·
[counter](https://ryanspice.com/dev/gpui/examples/counter/) ·
[LLMs guide](https://ryanspice.com/dev/gpui/llms.txt).

## Repository layout

- `gpui-sites/` — facade source (`sdk.mjs`, `Host.svelte`, Vite config) and the
  pinned-upstream patch applied by the build.
- `gpui-sites-public/` — static overlay: landing page, `llms.txt`, examples,
  TypeScript types and the scoped `.htaccess`.
- `Build-WebGPUI.ps1` — reproducible build from the pinned upstream revision;
  verifies the patch with `git apply --check` before building.
- `tests/test_gpui_sdk.py` — static contract tests for the shipped surface.
- `docs/` — build/release notes and the LLM demo-authoring guide.

## Build and verify

```powershell
pwsh -NoProfile -File .\Build-WebGPUI.ps1
python -m pytest tests/test_gpui_sdk.py -q
```

Publishing and rollback are separate, owner-authorized operations. See
[docs/GPUI-WEB-SDK.md](docs/GPUI-WEB-SDK.md) for deployment details and
[docs/GPUI-LLM-DEMO-GUIDE.md](docs/GPUI-LLM-DEMO-GUIDE.md) for authoring rules.

Upstream: https://github.com/countradooku/gpui-native
