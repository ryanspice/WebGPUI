import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// Build the standalone Svelte-first GPUI Web SDK from an isolated upstream
// checkout. The checkout must already contain:
//   - web/pkg/gpui_core.js + gpui_core_bg.wasm (from `bun run build:pages`)
//   - packages/svelte/dist (from `bun run build:adapters`)
// This config compiles gpui-sites/Host.svelte with the native GPUI Svelte
// compiler (gpuiSvelte plugin) and bundles gpui-sites/sdk.mjs into
// dist-sites/gpui/v1, emitting content-hashed chunks and the WASM asset.
const root = resolve(import.meta.dirname, '..');
// Bun's isolated node_modules layout does not hoist workspace packages to the
// root, so reference the Svelte adapter's built dist files directly.
const svelteVite = resolve(root, 'packages/svelte/dist/vite.js');
const svelteWeb = resolve(root, 'packages/svelte/dist/web.js');
const { gpuiSvelte } = await import(svelteVite);

export default defineConfig({
  root,
  base: './',
  publicDir: false,
  plugins: [gpuiSvelte()],
  resolve: {
    alias: [
      { find: /^@gpui-native\/svelte\/engine$/, replacement: resolve(root, 'packages/svelte/dist/engine.js') },
      { find: /^@gpui-native\/svelte\/public$/, replacement: resolve(root, 'packages/svelte/dist/public.js') },
      { find: /^@gpui-native\/svelte\/store$/, replacement: resolve(root, 'packages/svelte/dist/store.js') },
      { find: /^@gpui-native\/svelte\/reactivity$/, replacement: resolve(root, 'packages/svelte/dist/reactivity.js') },
      { find: /^@gpui-native\/svelte\/components$/, replacement: resolve(root, 'packages/svelte/dist/components.js') },
      { find: /^@gpui-native\/svelte\/host$/, replacement: resolve(root, 'packages/svelte/dist/host.js') },
      { find: /^@gpui-native\/svelte\/web$/, replacement: svelteWeb },
      { find: /^@gpui-native\/svelte$/, replacement: svelteWeb },
      { find: '@gpui-native/wasm', replacement: resolve(root, 'web/pkg/gpui_core.js') },
    ],
  },
  build: {
    target: 'es2022',
    outDir: resolve(root, 'dist-sites/gpui/v1'),
    emptyOutDir: true,
    assetsInlineLimit: 0,
    rollupOptions: {
      input: resolve(root, 'gpui-sites/sdk.mjs'),
      preserveEntrySignatures: 'strict',
      output: {
        format: 'es',
        entryFileNames: 'gpui.mjs',
        chunkFileNames: 'assets/[name]-[hash].mjs',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
});