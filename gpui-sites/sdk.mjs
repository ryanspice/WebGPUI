// Public ES-module facade (P0: CDN-only, no build step) over the real upstream
// GPUI Native Svelte/WebAssembly browser renderer. The `ui.*` helpers build a
// plain-JS declarative tree; `mount()` renders it through a precompiled Svelte
// host (@gpui-native/svelte/web). This is NOT React, NOT a DOM/CSS imitation:
// the host owns a genuine GPUI canvas.
import { render, resetRender as nativeResetRender, initGpuiWeb } from '@gpui-native/svelte/web';
import Host from './Host.svelte';

export { initGpuiWeb };
export const version = '0.3.1';

let mounted = false;

// Both documented style forms are accepted: `{ style: {...} }` and bare style
// props such as `{ gap, padding }`. Explicit `style` wins on key collisions.
// Handlers and control props are never folded into the style object.
const CONTROL_KEYS = new Set([
  'onPress', 'onClick', 'onKeyDown', 'onKeyUp', 'onFocus', 'onBlur', 'onChange',
  'value', 'placeholder', 'disabled', 'tabIndex', 'role', 'autoFocus',
  'ref', 'children',
]);
function gpuiProps(props = {}, keep = []) {
  const preserved = new Set(keep);
  const next = { ...props };
  const style = { ...(next.style ?? {}) };
  delete next.style;
  for (const key of Object.keys(next)) {
    if (CONTROL_KEYS.has(key) || preserved.has(key)) continue;
    style[key] = next[key];
    delete next[key];
  }
  next.style = style;
  return next;
}

// Declarative builders. Each returns a plain descriptor consumed by Host.svelte.
export const ui = {
  column(props = {}, children = []) { return { type: 'column', props: gpuiProps(props), children }; },
  row(props = {}, children = []) { return { type: 'row', props: gpuiProps(props), children }; },
  view(props = {}, children = []) { return { type: 'view', props: gpuiProps(props), children }; },
  text(value, props = {}) { return { type: 'text', props: gpuiProps(props), children: [String(value)] }; },
  button(label, onPress, props = {}) {
    return {
      type: 'button',
      props: { ...gpuiProps(props, ['onPress', 'disabled']), onPress },
      children: [String(label)],
    };
  },
  input(props = {}) {
    return { type: 'input', props: gpuiProps(props, ['value', 'placeholder', 'onChange', 'disabled']), children: [] };
  },
};

// Mount a single GPUI window. `config`:
//   initialState: object passed to the view
//   view: (state, update) => tree   — re-runs on every update()
//   title, width, height: window options
//   onError: optional (error) => void
// Returns the window root ({ render, close, unmount, ... }).
export async function mount(config = {}) {
  if (typeof document === 'undefined') throw new Error('GPUI Web requires a browser');
  if (mounted) throw new Error('mount() already called; call resetRender() before mounting again');
  const {
    initialState = {}, view, title = 'GPUI Web', width = 960, height = 640, onError,
  } = config;
  if (typeof view !== 'function') throw new Error('mount() requires a view(state, update) function');
  // Fail explicitly instead of resolving into a window that never opens.
  const webgl = document.createElement('canvas').getContext('webgl2');
  if (!webgl)
    throw new Error('GPUI Web requires WebGL2; it is not available');
  // Reserve before the first await. Without this, two concurrent mount() calls
  // both pass the guard and share one window before either sets the flag.
  mounted = true;
  try {
    await initGpuiWeb();
  } catch (error) {
    mounted = false;
    onError?.(error);
    throw new Error('GPUI Web initialization failed: ' + (error?.message ?? String(error)));
  }
  try {
    const root = render(Host, {
      title, width, height,
      ...(onError ? { onError } : {}),
      props: { tree: view, initialState, ...(onError ? { onError } : {}) },
    });
    const close = root.close?.bind(root);
    if (close) root.close = () => { mounted = false; close(); };
    return root;
  } catch (error) {
    mounted = false;
    onError?.(error);
    throw error;
  }
}

export function resetRender() {
  mounted = false;
  nativeResetRender();
}
