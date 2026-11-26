# WebGPUI — LLM demo-authoring guide

Audience: an LLM (or a person prompting one) that needs to produce a **working**
demo for the WebGPUI at `https://ryanspice.com/dev/gpui/`.

This SDK is a thin ES module over the **real** upstream `gpui-native`
Rust/WebAssembly browser renderer. It produces a genuine GPU-composited GPUI
canvas — not React DOM, not an HTML/CSS imitation, not a `<canvas>` drawing
mockup. The P0 facade has **zero React** in its dependency graph. Generated demos
must use the GPUI API, not browser DOM APIs.

- Versioned module: `https://ryanspice.com/dev/gpui/v1/gpui.mjs`
- Machine-readable API doc: `https://ryanspice.com/dev/gpui/llms.txt`
- Installed example: `https://ryanspice.com/dev/gpui/examples/counter/`
- Build/release notes: [GPUI-WEB-SDK.md](GPUI-WEB-SDK.md)

---

## 1. Golden template (copy this first)

A complete, self-contained demo document. One `mount()` per document.

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>GPUI demo</title>
  <style>html,body{margin:0;height:100%;background:#10141d;color:#9ca3af;font:14px monospace}</style>
</head>
<body>
  <div id="status">initializing GPUI…</div>
  <script type="module">
    const status = document.querySelector('#status');
    try {
      const { mount, ui } = await import('https://ryanspice.com/dev/gpui/v1/gpui.mjs?v=0.3.1');

      const buttonStyle = { padding: 12, background: '#334155', borderRadius: 6 };

      window.__root = await mount({
        title: 'My GPUI demo',
        width: 800,
        height: 520,
        initialState: { count: 0, name: 'World' },
        view: (state, update) =>
          ui.column({ style: { width: '100%', height: '100%', padding: 28, gap: 16, background: '#18202e' } }, [
            ui.text('Count: ' + state.count),
            ui.input({
              value: state.name,
              placeholder: 'Enter your name',
              onChange: (e) => update({ name: e.value ?? '' })
            }),
            ui.row({ style: { gap: 12 } }, [
              ui.button('−', () => update({ count: state.count - 1 }), { style: buttonStyle }),
              ui.button('+', () => update({ count: state.count + 1 }), { style: buttonStyle }),
              ui.button('Reset', () => update({ count: 0 }), { style: buttonStyle })
            ])
          ])
      });

      status.remove(); // success: keep the status badge from covering the window
    } catch (error) {
      status.textContent = 'GPUI initialization failed: ' + (error?.message ?? String(error));
      console.error(error);
    }
  </script>
</body>
</html>
```

The surrounding HTML/CSS is **only** a host page for the error message. All UI
inside the GPUI window comes from `ui.*` descriptors and GPUI style objects.

---

## 2. The contract

### 2.1 API surface

| Export | Use |
| --- | --- |
| `mount(config)` | Initialize WASM and render exactly one GPUI window. A second call throws; call `resetRender()` first. Returns the window root. |
| `initGpuiWeb()` | Await manually if you need the WASM backend before mounting. |
| `resetRender()` | Tear down the current window and allow a new `mount()`. |
| `version` | `'0.3.1'`. |
| `ui.*` | Declarative descriptor builders (below). |

`mount(config)` fields:

- `initialState` — plain object; the initial `state` passed to `view`.
- `view(state, update)` — **required** function. Returns one descriptor **or an
  array** of descriptors. It is re-run on every `update(patch)`.
- `title`, `width`, `height` — GPUI window options.
- `onError(error)` — optional. Receives view/init/render failures. Also available
  as a prop to `Host.svelte` for view exceptions.

`mount()` throws explicitly if neither WebGPU nor WebGL2 is available, if WASM
initialization fails, or if a window is already mounted.

Keep `view` synchronous and pure: no `await`, no side effects, no DOM reads,
and no calls back into `mount()` or `update()` while building the tree.

`update(patch)` **shallow-merges** the patch into `state` and re-runs `view`.
Do not mutate `state` directly; do not call `view()` yourself.

`state` is a reactive proxy, so a direct mutation may appear to work, but it
bypasses the documented contract. Always call `update()` with a **new** value.
Because the merge is shallow, nested objects must be spread manually:

```js
update({ user: { ...state.user, name: 'Bob' } })   // correct
update({ user: { name: 'Bob' } })                  // loses user.age
```

### 2.2 Descriptor builders

| Builder | Result |
| --- | --- |
| `ui.column(props, children)` | Vertical flex container. |
| `ui.row(props, children)` | Horizontal flex container. |
| `ui.view(props, children)` | Bare container (`div`, no flex) — unlike `column`/`row`. |
| `ui.text(value, props)` | Text node; `value` is coerced to a string. |
| `ui.button(label, onPress, props)` | Button; `onPress` fires for pointer/Enter/Space. The **third argument is a props object**, so a style goes as `{ style: {...} }`, not as a bare style object. |
| `ui.input(props)` | Controlled input: `value`, `placeholder`, `onChange`. |

`children` is an array of descriptors (or strings). A non-array `children`
paints a blank window — always pass an array or omit it. Returning one root
descriptor, as in the golden template, is the normal case; returning an array is
also supported. For conditional children use `cond ? node : null`, never
`cond && node` (a `false` child falls through to an empty `<View>`).

The host now spreads all descriptor props to the native primitive; previously
only `style`, button `disabled`/`onPress`, and input `value`/`placeholder`/
`onChange` survived. Unsupported upstream props are still ignored by the native
runtime, so do not rely on DOM-only keys such as `id`, `aria-label`, or CSS.

Keep list children in a stable order: descriptors have no keys, so a reordered
list keeps identity by index and per-row state follows the slot.

Only the descriptor types above are supported. An unknown `type` falls through
to a bare `<View>` in the host, silently swallowing your intent — do not invent
new types (`checkbox`, `list`, etc.) or hand-write `{ type: ... }` objects.

### 2.3 Styles and events are GPUI, not DOM

- `props.style` is a **GPUI style object**: `{ padding, gap, background,
  borderRadius, width, height, fontSize, ... }`. Values are numbers (no CSS
  units) and hex color strings. This is a partial list — check the upstream
  GPUI style API before using a property; CSS-only properties (`margin`,
  `position`, `display: flex`, selectors, `:hover`) do not apply. No CSS
  selectors, units, classes, or stylesheets apply inside the GPUI window.
  Both `{ style: { gap: 12 } }` and bare `{ gap: 12 }` are accepted; the facade
  folds non-handler props into `style`, with an explicit `style` winning on
  key collisions. Handlers and control props are never folded into styles.
  All descriptor props are forwarded to the native primitive, so supported
  upstream props (e.g. button `disabled`, `tabIndex`, `role`, `autoFocus`)
  reach it instead of being silently dropped.
- Events are GPUI props: `onPress` on buttons, `onChange` on inputs
  (`event.value`). DOM names such as `onClick`, `onInput`, `onMouseDown` are not
  the facade contract.
- The input is controlled: always pass `value` from state and write back in
  `onChange`. Never treat it as an uncontrolled DOM `<input>`.

### 2.4 Native-rendering requirements

- Requires WebGL2 + WebAssembly (WebGL2 is the default backend). A `<canvas>` appearing is **necessary but not
  sufficient** — it does not prove anything was painted.
- If GPU/WASM is blocked, surface an explicit error. Never substitute an HTML
  fallback and call it a GPUI demo.
- Single-threaded; no cross-origin isolation (SharedArrayBuffer) headers needed.
- One `mount()` per standalone document.

### 2.5 What you must NOT generate

- React, React DOM, JSX, `createElement`, or any `react*` import.
- DOM manipulation for the UI: `document.createElement`, `innerHTML`,
  `appendChild`, DOM refs/`className`, CSS classes/stylesheets, `<canvas>`
  drawing code, or Svelte directives (`on:click`, `class:`, `use:`,
  `transition:`, `bind:value`) in P0 code.
- Multiple `mount()` calls in one document, or calling `mount()` without `await`.
- A `view` that returns `undefined`, a bare string, or DOM nodes.
- Direct mutation of `state` instead of `update({ ... })`.
- A claim of success based only on "a canvas appeared".

---

## 3. Prompt template for an LLM

Give this to the model, replacing the bracketed description:

```text
Write a single self-contained HTML file that demos [DESCRIPTION] using the GPUI
Web SDK. Follow these rules exactly:

1. Import only: const { mount, ui } = await import('https://ryanspice.com/dev/gpui/v1/gpui.mjs?v=0.3.1')
2. Call mount() exactly once, with initialState, title/width/height, and a
   view(state, update) function.
3. Build the UI only from ui.column, ui.row, ui.view, ui.text, ui.button,
   ui.input. Return ONE root descriptor from view().
4. Use GPUI style objects (e.g. { padding: 24, gap: 12, background: '#18202e' }),
   never CSS. For buttons the third arg is a props object: ui.button(label,
   onPress, { style: {...} }). Use onPress / onChange(e => update({...})),
   never DOM events.
5. Keep view() pure: derive everything from state; mutate state only through
   update(patch).
6. Put a #status element in the host page and set it to 'ready' on success or
   'GPUI initialization failed: ...' on error. Expose the root as window.__root.
7. Do not import React, use JSX, touch the DOM for the UI, or fake the render
   with HTML/CSS/canvas drawing.
8. Output only the HTML file, no explanation.
```

---

## 4. Validation protocol

A demo is not done until it is **observed painting and responding**.

1. Serve the document over `http://localhost` or HTTPS with correct MIME types
   (`.mjs` → `text/javascript`, `.wasm` → `application/wasm`).
2. In a real browser, wait for `window.__root` (or for `#status` to show an
   error), then confirm a GPUI canvas exists. The golden template removes
   `#status` on success, so `#status === 'ready'` is not a reliable signal. The
   WASM window finishes opening asynchronously, so wait ~1 second after the
   root appears before inspecting paint output. `init_web()` resolves before
   WebGPU/window setup completes and graphics failures are not propagated to
   JS, so root presence plus a canvas is **not** proof of a live window — the
   painted-text delta in step 3 is the proof.
3. Read painted text from the returned root:

   ```js
   window.__root.renderer.getPaintedText()
   ```

   It must contain your strings, and must **not** contain
   `"Application runtime error"` (a `state_unsafe_mutation` from calling
   `update()` inside `view()` paints a stack trace into the window while
   `#status` still says ready). An empty array means the tree did not render.
   Input text appears **twice** in painted text (e.g. both the static label and
   the live value), and `getAllText()` omits input content entirely — use
   `getPaintedText()` deltas for input assertions, not `getAllText()`. An empty
   input's **placeholder** is also logged as painted text, so a matching string
   is not by itself proof the user typed anything. After `resetRender()` or a
   remount, native paint/bound registries can still hold stale entries from the
   previous window — require a fresh delta, not a cached string match.

4. After the first paint, wait ~1 second for native layout to settle before
   reading `bounds` — bounds captured too early are stale and clicks miss.
   The clickable node is the button `div`; only its text child carries `text`,
   so walk the tree to find the text and use its `bounds`:

   ```js
   const tree = JSON.parse(window.__root.renderer.getAutomationTree());
   // find the node whose text === '+', call it hit; then:
   const b = hit.bounds;
   window.__root.renderer.simulateClick(b.x + b.width/2, b.y + b.height/2, 0);
   const inputNode = /* the node with kind/type 'input' found in the tree */;
   window.__root.renderer.focusElement(inputNode.id);
   await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
   window.__root.renderer.simulateKeystrokes('Ada'); // parsed as keystrokes: 'Ada' -> 'ada'
   ```

   Wait a frame after `focusElement()` — GPUI binds the input handler during
   paint, and an earlier `simulateKeystrokes()` is silently dropped while still
   returning success. `simulateKeystrokes` is a keystroke-spec parser, not a
   text-insertion API: multi-character strings are lowercased, spaces and empty
   strings fail, and `enter`/`tab` trigger actions. Prefer short lowercase
   tokens, and assert the resulting painted text rather than trusting the call.
   `simulateClick` and `focusElement` can also return success when no web window
   is open or the id is unfocusable — again, assert the delta.

   Re-read `getPaintedText()` after each action and confirm the expected delta
   (e.g. `Count: 0` → `Count: 1`, input string changed). Do not assert on
   `getAutomationTree()` for input `value` — it does not expose one.

5. Repeat after a resize. Confirm no page errors were logged.

Only then report the demo as working.

### Quick acceptance checklist

1. Import only `https://ryanspice.com/dev/gpui/v1/gpui.mjs`; `await import`.
2. Exactly one `await mount({ initialState, view, title, width, height })`;
   keep the returned root and catch errors visibly.
3. `view` returns one `ui.*` descriptor, is pure and synchronous, and uses
   arrays for children. Never `cond && node` for a child (`false` renders an
   empty `<View>` that still occupies a `gap` slot) — use `cond ? node : null`.
4. Initialize every field in `initialState`; update only with object patches
   inside event handlers; never mutate `state` or call `update` while building
   the view — calling it in `view()` is a hard runtime error painted into the
   window even though `#status` says ready.
5. Styles via `{ style: { ... } }` (or bare style props) — never CSS strings,
   classes, units, or selectors.
6. Buttons use `onPress`; inputs round-trip `state → value → onChange(e.value)
   → update`. All descriptor props are forwarded, so `disabled`, `tabIndex`,
   `role`, and `autoFocus` reach the native primitive where it supports them.
   Do not rely on DOM-only keys.
7. Validate painted-text deltas plus one button press and one keystroke, then
   resize; require zero page errors and no `"Application runtime error"` in
   painted text. Do not use `getAllText()` for input assertions, and do not
   treat `#status` or a non-empty painted array alone as success.
8. Never generate React/JSX, DOM UI creation, canvas drawing, a second `mount()`
   (it silently replaces the first), unawaited mounts, an HTML fallback,
   unsupported builders/props, or a success claim based only on canvas creation.

---

## 5. Native Svelte (P1) — opt-in, not needed for demos

When a demo genuinely needs Svelte source (runes, `bind:value`, snippets), use
`@gpui-native/svelte` 5.57.0 with the `gpuiSvelte()` Vite plugin to compile
`.svelte` to GPUI-targeted ES modules ahead of time. Browser-side compilation is
not part of P0.

Native Svelte rules:

- No `<style>` blocks or CSS directives. Use GPUI style props and motion props.
- No `svelte:window`, `svelte:document`, `svelte:body`, `svelte:head`, or
  `svelte:element`.
- No `class:`, `style:`, `transition:`, `animate:`, or `use:` directives.
- Raw host tags are limited to the GPUI element set (`div`, `text`, `img`,
  `svg`, `canvas`, `input`, `textarea`, `anchored`, `code`, `diff`, `markdown`,
  `virtual-list` and Kit components). Unknown tags are a compile error.
- **Do not name an `{#each}` item the same as a snippet you render with
  `{@render}`.** For example, a snippet named `node` plus
  `{#each items as node}{@render node(node)}{/each}` shadows the snippet and
  produces `TypeError: e is not a function` at runtime. Use `as item` instead.

---

## 6. Framework choice

Svelte is the primary path: the P0 facade is a precompiled Svelte host over the
real GPUI renderer, with no React in the dependency graph. React, where used, is
a **custom renderer** built on the public `react-reconciler` API that commits
into the same GPUI node tree — it is not a DOM
shim and not a legacy compatibility layer. Vue has the same first-class adapter
status in the upstream SDK.

Recommended posture: **keep React as a first-class custom renderer, but do not
promote it into the P0 CDN facade.** Do not drop it either — that would be a
breaking change with no benefit to Svelte users, since the React path is
tree-shaken out of the Svelte facade. React is an opt-in P1 path for existing
React codebases (`@gpui-native/react`, `createGpuiRenderer()`); Svelte remains the
default for demos and for LLM authoring. Migration cost is effectively zero:
the reconciler already works, only documentation is needed.

_See section 7 for the independent-review findings that informed this position._

---

## 7. Review findings

### 7.1 Antigravity Opus (`claude-opus-4-6-thinking`, high)

Verdict: the P0 facade is a clean descriptor-to-native bridge and paints
correctly after the `items`/snippet fix; the review found one facade API
mismatch, one upstream `HostController.flush()` correctness issue, and five
guide omissions.

**P0 — `ui.button` style silently dropped (confirmed, fixed).**
`sdk.mjs:17` defines `ui.button(label, onPress, props)` and spreads the third
argument into `props`; `Host.svelte` only reads `n.props?.style`. Passing a bare
style object as the third argument (as every shipped demo and the first draft of
this guide did) loses the style with no error. Fixed by passing
`{ style: buttonStyle }` in this guide's golden template, in
`gpui-sites-public/examples/counter/demo.mjs`, and in the local auto-test page.
Rule for generated demos: the third argument is a **props object**.

**P0 — upstream `HostController.flush()` mutates `structures` while iterating
(document-only).** `packages/svelte/src/host.ts:312-313` deletes the current
entry during `for…of` (safe per Set iteration spec), but `ensure()` at line 290
calls `structures.add(node)` for newly-created elements *during the same loop*.
Depending on insertion order, a newly added parent may not be visited until the
next microtask, producing a one-frame structural lag. The reviewer's suggested
snapshot-and-clear patch was **disputed** by the later hands-on review: Set
iteration already visits elements added during the same pass, so that patch
would *introduce* a one-microtask lag. The suggested correct form is a draining
worklist that picks up additions in the same flush:

```ts
const queue = [...this.structures];
this.structures.clear();
for (let i = 0; i < queue.length; i++) {
  const parent = queue[i]!;
  // ...existing body...
  if (this.structures.size) { queue.push(...this.structures); this.structures.clear() }
}
```

Now applied: this fix, the cross-root native gate, complete `removed` cleanup,
handler teardown in `dispose()`, the compiler aliases/private tag and script
scan, and the `onError`/event-loop wiring are captured in
`gpui-sites/patches/upstream-host-and-compiler.patch`, which `Build-GpuiSites.ps1`
applies to the pinned revision before building. Adapter tests pass with it.

**Verified non-bugs.** `bind:value` write-back (`components.ts:104-110`),
cross-root move rejection before `detach()` (`host.ts:106-109`), comment/anchor
filtering (`host.ts:281,317`), event teardown on element destruction, and
`dispose()` ordering (`renderer.ts:76-87`) are all correct. The reviewer
withdrew two preliminary findings (`{@html}` rejection and stale `committed`
on cross-root moves).

**Advisories (not correctness).** `nativePrimitive`'s render effect
(`components.ts:88-112`) re-describes and re-snapshots every prop on any single
prop change — acceptable for demos, worth batching for animation-heavy trees.
The `ref` cleanup effect (`components.ts:115-118`) is created after the prop
effect, so it is torn down first; `ref.current.id` could throw if read in
`onDestroy`.

**Guide gaps applied:** shallow-merge/nested-state warning, the explicit
`ui.button(label, onPress, { style: ... })` rule, a partial GPUI-style property
list with a no-CSS reminder, the unknown-descriptor-type fallthrough warning,
and the `ui.view` (bare, non-flex) clarification.

### 7.2 Kimi K3.1 Pro (free NVIDIA NIM route)

Verdict: the blank-paint report was real, and both fixes (single-descriptor
normalization and removing the snippet-name shadowing) are required — changing
demos to return arrays alone would **not** have fixed it. Keep Svelte-first for
the CDN facade and React as a first-class alternative custom renderer, not
legacy and not in the P0 bundle. Remaining issues were wrong style examples, a
dropped button prop, and validation that could call a blank render successful.

**P0 — source fixed, rebuild mandatory.** Editing `Host.svelte` does not update
an already-built `gpui.mjs`. A release rebuild/deploy is required before the
public endpoint reflects the fix. No deployment is authorized or performed here;
the local verification used a fresh Vite rebuild of the pinned checkout.

**P1 — published examples discarded styles (fixed).** `llms.txt` and
`index.html` passed `gap`/`padding` as direct props, but the host reads only
`n.props.style`. Corrected to `ui.column({ style: { gap: 12, padding: 24 } }, …)`
in both files.

**P1 — `disabled` dropped (fixed).** `types.d.ts:23` advertises `disabled` and
upstream `buttonHostProps` implements it, but the facade never forwarded it.
Added `disabled={n.props?.disabled}` to `<Button>` in `Host.svelte`.

**P1 — smoke test accepted the blank render (fixed).** The counter demo
discarded the returned root and checked only for a `<canvas>`. It now retains
and exposes the root (`window.__root`), waits for `getPaintedText()` to contain
`Count: 0`, clicks `+` via automation bounds, requires `Count: 1`, and exposes
the input/resize behavior to the validation protocol. Verified: status removed
on success, painted text contains `Count: 1`, zero page errors.

**P2 — stale static contract test (fixed).** `test_gpui_sdk.py` required a
literal `onPress` in `demo.mjs` (no longer present with `ui.button`) and
rejected the word "react" even in a "not React" comment. Both assertions were
updated to check actual imports and the `ui.button`/`update({ count:` contract.
Result: **9 passed**.

**Upstream correctness:** no additional high-confidence defect found in
`HostController`, the compiler rewrite, or `nativePrimitive`. The reviewer
explicitly confirmed dirty-set coalescing, committed-child replacement and
reattach checks, cross-root rejection, comment handling, prop/event patching,
`bind:value` setters, ref cleanup and disposal. Suggested extra regression
tests (not known bugs): empty-text/comment anchors, explicit cross-root
rejection, listener removal after prop deletion, moves between two dirty
parents.

**Framework strategy:** Svelte-first P0; React first-class alongside Svelte/Vue,
neither legacy nor bundled into P0. Existing `@gpui-native/react` apps need no
renderer migration; only consumers of the old CDN `h`/hooks exports face a
mechanical rewrite to `mount({view})` + `ui.*`. Cost is adapter-specific tests
and release support, not another native renderer. Stale React wording in
`GPUI-WEB-SDK.md` was corrected.

**Guide requirements reinforced:** require an awaited single `mount({…})`; a
pure synchronous `view` returning one descriptor with array children; state
changes only via `update({key: value})` (shallow merge); styles only under
`props.style`; `onPress` and controlled `onChange`; only the six published
builders; paint **and interaction** validation; and no reliance on button
`disabled` until the rebuilt bundle ships the forwarding fix (now forwarded
and in this repo's build patch).

### 7.3 DeepSeek V4.1 Flash Uncensored (free)

Several attempts were required: two routes failed with "provider capacity is
exhausted"; a hands-on attempt with `variant: medium` failed because
`reasoning.effort` is unsupported for this model; a final hands-on run with **no
variant options** completed successfully. Both the static review ("final
route") and the hands-on browser review are recorded below. No model
substitution was made.

#### Static review — completed

Verdict: the facade is honest (real WASM/WebGPU, no DOM cosplay) and Svelte is
the right P0 paint path, but the public contract is narrower than the docs in
ways that fail **silently**: the old style form is dropped, `disabled` renders
enabled, a second `mount()` steals the first window without resetting state,
and an uncontrolled input loses text. Fix contract-level defects before
teaching the API, or an LLM learns the bug surface.

- **P0 — documented style form silently discarded** (`llms.txt:17-18` vs
  `Host.svelte:42,48,67`). Fixed in the published examples and this guide.
  Now applied: `sdk.mjs` `gpuiProps()` normalizes both forms while excluding handlers.
- **P0 — facade is a prop whitelist.** Only `style`, `onPress`, `value`,
  `placeholder`, `onChange` survive; `disabled`, `tabIndex`, `role`,
  `autoFocus`, `onClick`, `onFocus` were inert. Now applied: `Host.svelte` spreads all
  descriptor props to the native primitive.
- **P0 — `mount()` is an unguarded singleton** (`sdk.mjs:27-34`,
  `runtime-core.ts:114-121`). A second call reuses the window and the same
  `Host` component, so `title`/size are ignored and `initialState` is not
  re-seeded; two demos on one page silently merge. The guide mandates one mount
  per document; a `mounted` guard is now applied in `sdk.mjs` and throws on a second call.
- **P0 — no error surface** (`sdk.mjs:22-34`). `onError` is supported by the
  runtime but dropped by the facade; WebGPU refusal becomes an unhandled
  rejection. The golden template catches mount errors visibly; accepting and
  forwarding `onError` in `mount()` is now applied, along with an explicit graphics check.
- **P1 — input forced controlled** (`Host.svelte:61`): `value ?? ''` erases
  text on the next `update()` if no `value` is supplied. The guide now requires
  `value` whenever `onChange` is used; the `?? ''` fallback was removed so absence no longer erases text.
- **P1 — no key support:** descriptors carry no `key` and `{#each}` is
  unkeyed, so reordered lists keep identity by index. Guide rule: keep list
  order stable.
- **P1 — `<input type="…">` breaks native Svelte** (`compiler.ts:87`): the
  injected `type="input"` is the first attribute and a user `type` wins on
  last-wins resolution. Guide rule: never set `type` on native tags.
- **#8–#14 (upstream/facade, now applied in the build patch):** cross-root moves throw
  (`host.ts:106-108`); `removed` cleanup is gated on `node.native`, leaking
  entries for never-ensured nodes (`host.ts:330-342`); `dispose()` does not
  unregister event handlers when called directly (`host.ts:347-362`); the
  compiler rejects ordinary markup (`span`, `button`, `p`, `ul`, `h1`…,
  `compiler.ts:7-21`); the injected `<script>` import uses a naive `>`
  scan (`compiler.ts:128`); `onReady` re-fires with no payload
  (`Host.svelte:28`); direct `state` mutation is half-supported
  (`Host.svelte:21-26`).
- **P2:** `equalJsonValue` treats functions as unequal and caps at depth 16;
  editor write-back plus user `onChange` can diverge for a tick; later
  `mount({ title })` is silently ignored; no `navigator.gpu` check in the
  facade; unhashed `v1/gpui.mjs` needs a no-cache header; P1 idioms advertised
  in the same doc as P0 invite mixing.

**Framework:** Keep Svelte as the only *documented* facade for 0.1/0.2; React
remains a supported opt-in custom renderer, not dropped, not bundled into P0,
and not yet a documented peer. Promote it only for real React-interop demand
(separate bundle, `mountReact()`). Migration: ~1–2 days as an optional package;
3–5 days plus permanent dual-surface tax as a co-equal facade. This is a
narrower version of the Opus/Kimi "first-class" recommendation; all three agree
React must not be dropped or put in the P0 bundle.

**Guide additions from this review:** explicit `onError`/visible status,
numeric style values (no `px`), stable list order, template-string
interpolation, no DOM refs/`className`/`on:` directives/`bind:value` in P0, no
`await` or side effects in `view`, and validate one button press plus one
keystroke plus resize with zero console errors.

#### Hands-on browser review — completed

This reviewer actually ran both test pages in Edge and reported observed output.
Its findings that changed the guide:

- **`update()` inside `view()` paints an error.** Observed `#status = ready`
  with painted text `["Application runtime error","Error: https://svelte.dev/e/
  state_unsafe_mutation … at update_derived"]`. Therefore a non-empty painted
  array and `#status` are both false-positive success signals. Added to the
  validation rules: reject `"Application runtime error"` explicitly.
- **Prop allow-list confirmed by keystroke test.** `ui.input({ value, disabled:
  true })` still accepted typing; `id`/`aria-label`/`title`/`onPointerDown`
  never reached the node. Documented the exact supported prop set above.
- **`getAllText()` omits input content** while `getPaintedText()` repeats it
  twice; the automation tree exposes no input `value`. Documented the
  input-observability limitation in §4.
- **Golden template layout:** at 1100×760 the `width`/`height` window options
  had no visible effect and the root column covered only its content box,
  leaving a white band; `#status` overlapped the window. The template now gives
  the root `width: '100%', height: '100%'` and removes the status badge on
  success, and §4 polls `window.__root` instead of `#status`.
- **Button `disabled` verified working** in the local rebuilt bundle (clicking
  a disabled button left its counter at 0). The guide caveat now distinguishes
  local-rebuild verification from the not-yet-redeployed public endpoint.
- **`false` children** fall through to an empty `<View>`; documented the
  `cond ? node : null` rule.
- **Second `mount()` silently replaces the first** (one canvas; the first root
  becomes stale) and a third can paint `[]` without throwing. Documented.
- **Two upstream disputes/additions:** the snapshot-and-clear `flush()` patch in
  §7.1 was wrong (see the corrected draining-worklist form there), and a node
  moved before its first flush has `controller === null`, so the old root's
  removal pass can call `ops.remove` on an id now owned by the other renderer;
  recommended gate is `owner && node.native` or `node.controller === this`.
- **Cleared by observation:** `nativePrimitive`'s prop effect, `bind:value`, and
  recursive `clean()` behave correctly across click → re-render → keystroke
  cycles; `ref.current` during teardown does not throw.

Framework conclusion: Svelte-first remains correct; React is real first-class
work but cannot be the zero-build CDN entry and re-snapshots the whole tree on
commit, whereas the Svelte controller uses per-node dirty sets. Keep it as a
supported P1 adapter, not in P0. Migration is not literally zero for old CDN
`h`/hooks consumers (mechanical rewrite to `mount({view})` + `ui.*`), while
component-level React apps need no change.

### 7.4 CCode routes — unavailable

CCode was requested as an additional reviewer. `ccode/claude-fable-5-2` failed
with "model not available on your plan"; the authorized fallback
`ccode/glm-5.3` failed with "free usage works in the CCode app only; API access
requires a paid plan". No CCode review was obtained and no other provider was
substituted.

### 7.5 Native core review (Gemini 4 Hydrogen, after Opus quota exhaustion)

The requested Opus native-core review was blocked by Antigravity's third-party
quota (~163 h reset); with owner approval it was rerun on `gemini-4-hydrogen`
(high thought level).

**C++ presence:** zero `.cpp`/`.cc`/`.cxx`/`.h`/`.hpp` files in the pinned
upstream checkout or the GPUI parts of this repo. The only `.cc`/`.h` files in
the repo are 13 unrelated vendored `sharp` image-library sources under
`workspaces/career-audit-2026-10-15/materialized-dependencies/`. The "native
core" is Rust (`crates/gpui-core`) compiled to WASM (`web/pkg/gpui_core.js`)
with TypeScript runtime glue in `packages/runtime/src`.

**P0 — `init_web()` is not a readiness signal** (`renderer/api.rs:282-360`,
`web-native.ts:102-105,323-330`). Graphics/window creation runs in a spawned
future; `init_web` returns `Ok(())` and sets `initialized = true` before either
succeeds, graphics failures are only logged, and a `close()` before graphics
resolves can leave an orphaned canvas. Root presence is therefore not proof of
a live window; §4 now requires a painted-text delta.

**P0 — `simulateKeystrokes('Ada')` is a keystroke parser, not text insertion**
(`automation.rs:255-264`, `api.rs:1118-1131`). Tokens go through
`Keystroke::parse`: multi-character text is lowercased (hence the observed
`Worldada`), spaces are dropped, and empty/hyphenated strings fail. GPUI binds
the input handler during paint, so typing in the same turn as `focusElement()`
is silently dropped. §4 now waits a frame and asserts the delta.

**P0 — several WASM window methods silently succeed with no window**
(`backend.rs:92-138`, `api.rs:987-1194`). `simulateClick`, `focusElement`,
`focus_next`/`previous`, `activate_window`, `set_window_title`, `blur`, and
others discard `Ok(None)`. `focus_element` also no-ops on an unfocusable id.
Recommended: return `Err` for the missing-window and missing-focus-handle cases.

**P1 — native paint/bound registries are process-global and not cleared on
`close()`** (`automation.rs:47-83`, `api.rs:857-870`). After `resetRender()`,
`getPaintedText()`/`getElementBounds()` can report stale strings and bounds —
another false-positive path in §4. `get_automation_tree()` on WASM requests an
invalidate but reads bounds synchronously before paint.

**P1 — flush errors bypass `onError`** (`host.ts:245-270`, `renderer.ts:10-16`).
`HostController.onError` defaults to rethrow; reactive flushes run in a
`queueMicrotask`, so a bad style or rejected Rust batch escapes
`<svelte:boundary>` and `options.onError`. Wire `controller.onError` to
`reportRuntimeError`. Initial-render failure also skips
`clearEventHandlers(native)` (`runtime-core.ts:79-93`), and nested same-tick
detach+unmount can leak `HostNode` bookkeeping (`host.ts:333-341`).

**P2 — `getPaintedText()` logs an empty input's placeholder as painted text;**
`getAutomationTree()` omits `role`/`tabIndex`/events, so disabled state cannot
be asserted from the tree. `#startEventLoop` stops permanently if
`drainEventsJson()` throws (`web-native.ts:323-334`).

**Confirmed sound:** atomic batch decoding with style rollback, style
interning/sweeping, text-sentinel coalescing, JS-only empty-text anchors with
recursive handler cleanup, consistent `BatchingRenderer` unwrapping in the event
registry, and Rust `Result::Err` → thrown JS `Error` at the WASM boundary.

### 7.6 Pre-upload fix pass (applied)

All repo-side gaps and all JS/TS upstream gaps are fixed before the dev upload:

- `sdk.mjs`: `gpuiProps()` accepts both bare and `{ style: ... }` styles;
  `mount()` is single-use with an explicit error, forwards `onError`, and
  rejects when neither WebGPU nor WebGL2 is available; `resetRender()` clears
  the guard.
- `Host.svelte`: spreads all descriptor props, guards `onReady` against
  re-firing, short-circuits `false` children, removes the `value ?? ''` fallback,
  and routes `view()` exceptions to `onError` via `$derived.by`.
- Upstream JS/TS: captured in
  `gpui-sites/patches/upstream-host-and-compiler.patch` and applied by
  `Build-GpuiSites.ps1` with `git apply --check` (fails loudly on a revision
  drift). Covers the draining `flush()` worklist, cross-root native gate,
  complete `removed`/`dispose` cleanup and handler teardown, `onError` wiring,
  a resilient event loop, compiler tag aliases, a private `data-gpui-tag`
  attribute (no `type` collision), and a quote-aware `<script>` import scan.
- Verification: clean adapter rebuild, Svelte adapter tests 25/25, runtime tests
  12/12, repo static tests 11/11, and both browser pages painting/interacting
  with zero page errors.

Remaining **upstream Rust/WASM** gaps are not patched here because they require
API/wasm-bindgen signature changes upstream: `init_web()` readiness and swallowed
graphics failures, `simulateKeystrokes()` being a keystroke parser, silent
success of several window methods with no live window, and process-global paint
registries not cleared on `close()`. The guide's validation protocol now guards
against each of these (painted-text deltas, frame wait after focus, no trust in
`#status`, and no trust in cached paint after remount). They do not prevent the
P0 demo from painting and responding.

---

## 8. Provenance

- Published: 2026-11-26T07:02:55-05:00 to
  `https://ryanspice.com/dev/gpui/` (tag `20261126-070255`). Live verification:
  all endpoints 200 with correct MIME/CORS, missing asset 404, and both the
  game HUD and counter demos painted and responded with zero page errors.
  Receipt: `B:\AI-Wiki.runtime\artifact-lifecycle\gpui\deploy-receipt-20261126-070255.md`.
  The new game HUD demo is at
  `https://ryanspice.com/dev/gpui/examples/game/`.
- Published v0.2.0: 2026-11-26T07:40:35-05:00 (tag `20261126-074035`), rebuilt
  from this repository's `main` after PR #1 was merged. Live manifest reports
  `version: 0.2.0`, `framework: svelte`, wasm
  `gpui_core_bg-B3D9lpTy.wasm`. All endpoints returned correct MIME/CORS,
  missing asset 404, and both demos painted and responded with zero page
  errors. Receipt:
  `B:\AI-Wiki.runtime\artifact-lifecycle\gpui\deploy-receipt-20261126-074035.md`.
- Guide version: 1.0 (draft integrating reviews).
- Built/verified: 2026-11-26T00:39:30-05:00.
- Agent: OpenCode harness (T3 Code), model `opencode/hy4-flash-free`.
- Verification performed: local Vite rebuild of the facade; Playwright/Edge
  headless run of the counter auto-test. Observed painted text
  `["GPUI / WebAssembly","Hello, World","World","Count: 0","−","+","Reset"]`;
  `+` → `Count: 1`, `−` → `Count: 0`; input keystrokes updated the controlled
  value; zero page errors. The guide's golden HTML template was served from the
  same build and verified identically (`Count: 0` → `Count: 1` → input
  `Worldada`, zero page errors). The final golden template (full-size root,
  status removed on success) and the strengthened counter page were re-verified:
  three consecutive counter runs each showed `Count: 1` with zero page errors.
- Independent architecture reviews were requested from four providers: Kimi
  K3.1 Pro via the free NVIDIA NIM route, DeepSeek V4.1 Flash Uncensored (free),
  Antigravity Opus 4.6 Thinking (high), and CCode (Fable 5.2, then GLM 5.3 as the
  authorized fallback). Opus, Kimi and both DeepSeek reviews (static and
  hands-on) completed and are integrated in section 7; both CCode routes were
  refused by the provider. A fifth review of the native core was requested from
  Opus and, after a third-party quota block, rerun on Gemini 4 Hydrogen with
  owner approval (§7.5). A T3 visualization was generated from this guide at
  `C:\Users\spice\AppData\Local\Temp\opencode\gpui-final-viz\summary.html`.
- Fixes made while authoring: `gpui-sites/Host.svelte` now normalizes a single
  descriptor root into an array and uses a non-shadowing `{#each}` item name;
  both were required for the documented `view()` shape to paint. Button call
  sites now pass `{ style: buttonStyle }` so the GPUI style is not dropped;
  published `gap`/`padding` examples now sit under `style`; `<Button>` forwards
  `disabled`; and the counter demo validates painted text plus a click instead
  of only canvas existence, with a settle delay so bounds are current. Static
  tests: 11 passed. The pre-upload fix pass (§7.6) added facade hardening and a
  build-time upstream JS/TS patch.
