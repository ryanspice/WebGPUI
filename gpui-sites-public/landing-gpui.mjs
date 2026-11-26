// GPUI rendering of the SDK landing page. All visible page content below is
// built from P0 descriptors and painted by the real WASM/WebGL2 renderer.
import { mount, ui } from './v1/gpui.mjs?v=0.3.1';

const colors = {
  page: '#10141d',
  card: '#161d2a',
  code: '#1b2332',
  border: '#374151',
  heading: '#e2e8f0',
  body: '#cbd5e1',
  muted: '#9ca3af',
  link: '#89b4ff',
  ok: '#3ecfa2',
};

const text = (value, style = {}) => ui.text(value, {
  style: { color: colors.body, fontSize: 16, lineHeight: 26, ...style },
});

const openLink = (href) => () => window.location.assign(new URL(href, window.location.href).href);

const link = (label, href, style = {}) => ui.button(label, openLink(href), {
  style: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 0, background: colors.page, borderWidth: 0,
    color: colors.link, fontSize: 13, fontWeight: 500,
    hover: { color: '#bfdbfe', textDecoration: 'underline' },
    ...style,
  },
});

const sectionTitle = (label) => text(label, {
  width: '100%', marginTop: 34, paddingBottom: 8,
  borderBottomWidth: 1, borderColor: '#2a3446',
  color: colors.heading, fontSize: 22, fontWeight: 600, lineHeight: 30,
});

const PAGE_PADDING = 24;
const CARD_MIN_WIDTH = 220;
const CARD_GAP = 12;

const columnsFor = (width) => Math.max(1, Math.floor((width - 2 * PAGE_PADDING + CARD_GAP) / (CARD_MIN_WIDTH + CARD_GAP)));
const widthForColumns = (count) => count * (CARD_MIN_WIDTH + CARD_GAP) - CARD_GAP + 2 * PAGE_PADDING;
const HYSTERESIS = 24;

function landingLayout(width, forcedColumns) {
  const contentWidth = width - 2 * PAGE_PADDING;
  const columns = forcedColumns ?? columnsFor(width);
  return {
    columns,
    cardWidth: Math.floor((contentWidth - (columns - 1) * CARD_GAP) / columns),
    compact: columns === 1,
    height: columns === 1 ? 2000 : columns === 2 ? 1800 : 1280,
  };
}

const endpoint = (title, description, href, width) => ui.view({
  style: {
    width, minHeight: 86, padding: 14, gap: 4,
    background: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 8,
  },
}, [
  link(title, href, {
    width: '100%', justifyContent: 'flex-start', background: colors.card,
    color: colors.link, fontSize: 16, fontWeight: 600,
  }),
  text(description, { color: colors.muted, fontSize: 13, lineHeight: 20 }),
]);

function landingTree({ cardWidth, compact, snippet, status, revision }) {
  const endpoints = [
    ['Native counter', 'Interactive GPUI smoke test', './examples/counter/'],
    ['Game HUD', 'GPUI dashboard demo', './examples/game/'],
    ['Renderer toggle', 'GPUI vs HTML, side by side', './examples/compare/'],
    ['Stats', 'Measured renderer comparison', './examples/stats/'],
    ['manifest.json', 'Version, upstream commit, exports', './v1/manifest.json'],
    ['llms.txt', 'AI authoring guide', './llms.txt'],
    ['gpui.mjs', 'Stable ES module entry', './v1/gpui.mjs'],
  ];

  return ui.column({
    style: { width: '100%', height: '100%', padding: PAGE_PADDING, background: colors.page },
  }, [
    text('WebGPUI · build v0.3.1', {
      color: colors.muted, fontSize: 12, fontWeight: 600, lineHeight: 18,
    }),
    text('Native GPUI, on the web.', {
      marginTop: 8, marginBottom: 12, color: '#f1f5f9',
      fontSize: compact ? 40 : 44, fontWeight: 700, lineHeight: compact ? 44 : 48,
    }),
    text('A versioned JavaScript (ES module) adapter over the upstream GPUI Native WebAssembly renderer. The default documentation is ordinary HTML; switch to GPUI to render this same page through a genuine GPUI canvas — no React DOM, no HTML/CSS imitation of the widgets.', {
      width: '100%', color: colors.heading,
    }),
    ui.row({
      style: {
        width: '100%', alignItems: 'center', gap: 10, marginTop: 22, marginBottom: 8,
        padding: 14, background: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 8,
      },
    }, [
      ui.view({ style: { width: 10, height: 10, flexShrink: 0, borderRadius: 999, background: colors.ok } }),
      text(status, { flexGrow: 1, flexShrink: 1, minWidth: 0, color: colors.heading, fontSize: 13, lineHeight: 20 }),
    ]),

    sectionTitle('Import it'),
    text('Drop this into a standalone HTML file. No npm install, no bundler, no Rust toolchain, no token.', {
      width: '100%', marginTop: 12,
    }),
    ui.column({
      style: {
        width: '100%', marginTop: 16, padding: 20, gap: 0,
        background: colors.code, borderWidth: 1, borderColor: colors.border, borderRadius: 8,
      },
    }, snippet.split('\n').map((line) => text(line || ' ', {
      width: '100%', color: colors.heading, fontFamily: 'monospace', fontSize: 13, lineHeight: 21,
    }))),

    sectionTitle('Endpoints'),
    ui.row({
      style: { width: '100%', flexWrap: 'wrap', gap: CARD_GAP, marginTop: 16 },
    }, endpoints.map(([title, description, href]) => endpoint(title, description, href, cardWidth))),

    sectionTitle('Requirements'),
    text('The runtime is single-threaded WebAssembly and uses WebGL2 by default (build v0.3.1), plus WebAssembly support in the browser. It does not require cross-origin isolation (SharedArrayBuffer) headers. If WebGL2 or WASM is unavailable the example shows an explicit initialization error — it never silently falls back to HTML rendering.', {
      width: '100%', marginTop: 12, color: colors.heading,
    }),

    ui.row({
      style: { width: '100%', flexWrap: 'wrap', alignItems: 'center', gap: 4, marginTop: 42 },
    }, [
      text('Part of', { color: colors.muted, fontSize: 13, lineHeight: 20 }),
      link('ryanspice.com', 'https://ryanspice.com/'),
      text('. Built from pinned upstream', { color: colors.muted, fontSize: 13, lineHeight: 20 }),
      link('countradooku/gpui-native', 'https://github.com/countradooku/gpui-native'),
      text(revision + '; license notices ship with the assets.', { width: '100%', color: colors.muted, fontSize: 13, lineHeight: 20 }),
    ]),
    text('GPUI mode · real WASM/WebGL2 canvas · no DOM widgets', {
      width: '100%', marginTop: 20, color: colors.muted, fontSize: 12, lineHeight: 18,
    }),
  ]);
}

export async function mountLanding(stage) {
  let width = stage.clientWidth || Math.min(document.documentElement.clientWidth, 780);
  // The engine fills the canvas parent in both axes. A definite stage height
  // lets it resize with the page without falling back to the canvas aspect ratio.
  const sizeStage = (next) => {
    const height = `${next.height}px`;
    if (stage.style.height !== height) stage.style.height = height;
  };
  const layout = landingLayout(width);
  sizeStage(layout);
  let columns = layout.columns;
  let updateLayout;
  const root = await mount({
    title: 'WebGPUI SDK landing page',
    width,
    height: layout.height,
    initialState: { cardWidth: layout.cardWidth, compact: layout.compact },
    view: (state, update) => {
      updateLayout = update;
      return landingTree({
        cardWidth: state.cardWidth,
        compact: state.compact,
        snippet: document.querySelector('#snippet')?.textContent ?? '',
        status: document.querySelector('#status')?.textContent ?? 'JavaScript endpoint reachable.',
        revision: document.querySelector('#rev')?.textContent ?? '',
      });
    },
  });
  window.__root = root;

  const deadline = Date.now() + 15000;
  let canvas;
  while (!canvas && Date.now() < deadline) {
    canvas = document.querySelector('canvas');
    if (!canvas) await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (!canvas) throw new Error('GPUI did not create a canvas within 15 seconds');

  // The engine appends its canvas to document.body; move it into the panel so
  // switching back to HTML really hides the native renderer.
  stage.appendChild(canvas);
  canvas.dataset.gpuiLanding = 'true';
  canvas.setAttribute('aria-label', 'WebGPUI landing page rendered by GPUI');
  // Resize only at the end of a drag, and only when the column count really
  // changes. Re-laying out the native tree on every resize frame is what made
  // the endpoint cards flicker; hysteresis also stops scrollbar-induced flips.
  let resizeTimer = 0;
  const applyResize = () => {
    const nextWidth = stage.clientWidth;
    if (!nextWidth) return;
    const rawColumns = columnsFor(nextWidth);
    let nextColumns = rawColumns;
    if (nextColumns > columns && nextWidth < widthForColumns(columns + 1) + HYSTERESIS)
      nextColumns = columns;
    if (nextColumns < columns && nextWidth > widthForColumns(columns) - HYSTERESIS)
      nextColumns = columns;
    if (nextColumns === columns) return;
    columns = nextColumns;
    width = nextWidth;
    const next = landingLayout(width, columns);
    sizeStage(next);
    updateLayout?.({ cardWidth: next.cardWidth, compact: next.compact });
  };
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(applyResize, 180);
  });

  const paintDeadline = Date.now() + 10000;
  let painted = [];
  while (Date.now() < paintDeadline) {
    painted = root.renderer?.getPaintedText?.() ?? [];
    if (painted.some((value) => value.includes('Native GPUI, on the web.'))) return root;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('GPUI canvas exists but the landing page did not paint: ' + JSON.stringify(painted));
}
