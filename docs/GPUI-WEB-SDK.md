# WebGPUI — build & release

For authoring demos with an LLM, see [GPUI-LLM-DEMO-GUIDE.md](GPUI-LLM-DEMO-GUIDE.md).

This directory (`gpui-sites/`) plus `gpui-sites-public/` and `Build-GpuiSites.ps1`
produce the static WebGPUI deployed at `https://ryanspice.com/dev/gpui/`.
The runtime is the **real** upstream GPUI Native Svelte 5 / WebAssembly browser
renderer — not React DOM, canvas mockups, or HTML/CSS.

## What gets built

- `gpui-sites/sdk.mjs` — thin ES-module facade over `@gpui-native/svelte/web`.
- `gpui-sites/vite.config.mts` — bundles the facade into `dist-sites/gpui/v1/`
  with content-hashed chunks and a separate `.wasm` asset.
- `gpui-sites-public/` — landing page, `examples/counter/`, `v1/manifest.json`,
  `llms.txt`. Copied into `dist-sites/` so the public URL has no duplicated
  `gpui` segment.
- `Build-GpuiSites.ps1` — one-command reproducible build from a pinned commit.
  It applies `gpui-sites/patches/upstream-host-and-compiler.patch` to that
  revision (Svelte host/compiler/runtime fixes) and fails loudly if the patch
  no longer applies.

## Prerequisites

- Git, Bun **1.4** (upstream `packageManager`; 1.2.x cannot read `bun.lock`).
- Rust/rustup with the `wasm32-unknown-unknown` target (the script uses the
  upstream `rust-toolchain.toml`).
- The `wasm-bindgen` CLI matching upstream `crates/gpui-core/Cargo.toml`
  (`0.2.127`). The script installs it via `cargo install` if missing.

## Build

```powershell
pwsh -NoProfile -File .\Build-WebGPUI.ps1
# Reproduce a specific upstream revision:
pwsh -NoProfile -File .\Build-WebGPUI.ps1 -Ref <commit>
```

The script clones upstream into an isolated `.build/` workspace, builds the
browser WASM + adapters, bundles the SDK, copies the public overlay into
`dist-sites/gpui/`, stamps the resolved commit and WASM asset list into
`manifest.json`, and copies license notices. Output: `dist-sites/` (serve the
`gpui/` child at the `/dev/gpui/` prefix).

## Serve & verify locally

```powershell
python -m http.server 8080 --directory <path-to>\dist-sites
# open http://localhost:8080/gpui/  and  http://localhost:8080/gpui/examples/counter/
```

Confirm: the counter paints in a real GPUI canvas; `+`, `−`, `Reset`, the text
input, keyboard and resize all work; the browser Network tab shows `gpui.mjs`
as JavaScript and the `.wasm` as `application/wasm`; a missing asset URL
returns an error, not the SPA `404.html`.

## Deployment

Deployed manually to `ryanspice.com/dev/gpui/` (the `dev/` area is a managed
SvelteKit deploy; this SDK is a static subdirectory alongside it). The
`dist-sites/gpui/` tree is copied to `public_html/dev/gpui/` and a local
`.htaccess` scopes the rules to this feature only:

- `AddType text/javascript .mjs` + `AddType application/wasm .wasm` (Apache
  `mod_mime` doesn't know these extensions by default; without this, `nosniff`
  makes browsers reject the module).
- `RewriteOptions InheritDownBefore` + `RewriteRule ^$ index.html [L]` so the
  parent `/dev/` SvelteKit `.htaccess` (which 308-strips trailing slashes and has
  a `router.php` catch-all) doesn't hijack the directory index.
- `Access-Control-Allow-Origin: *` on all `/dev/gpui/` assets (public, no
  credentials).
- `Cache-Control: immutable` for content-hashed `.mjs`/`.wasm` chunks, but **not**
  for the unhashed entry `v1/gpui.mjs` — give it a short/no-cache rule so a
  long-cached entry cannot pin a stale build against fresh hashed chunks.
- Missing assets return `404` (no SPA fallback).
- **Retain previously published hashed assets across swaps.** A tab that
  imported an older `gpui.mjs` may mount later and still request its original
  `gpui_core_bg-<hash>.wasm`; deleting old hashes breaks that deferred mount.
  Copy prior `v1/assets/` files into the new tree before removing the old one.

The root `deploy_verified.py` `.htaccess` also carries matching CORS/wasm rules
for the portfolio root, but the `/dev/gpui/` deploy uses its own local
`.htaccess` (the `dev/` area is not managed by `deploy_verified.py`).

Do **not** push to `master` or publish production without owner approval and a
successful preview/staging verification.

## Acceptance checklist

1. `Build-GpuiSites.ps1` exits 0; `dist-sites/gpui/v1/gpui.mjs` + `*.wasm` exist;
   manifest lists the verified exports and the pinned `upstreamRevision`.
2. Every JS/WASM request returns 200 with correct MIME; no fallback HTML for
   asset paths.
3. The counter visibly paints in GPUI; increment/decrement/reset, text input,
   keyboard and resize work.
4. A second HTML document on a different HTTPS origin imports the absolute
   `gpui.mjs` URL and renders (CORS verified on module + wasm).
5. An unauthenticated browser loads the public release; cache + license notices
   are present. Only then report the endpoint live.