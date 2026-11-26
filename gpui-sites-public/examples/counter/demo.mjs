// Real GPUI smoke test (P0 facade): counter state, controlled text input,
// keyboard/pointer interaction and resize. Imports the absolute SDK entry.
const status = document.querySelector('#status');
try {
  const { mount, ui } = await import('../../v1/gpui.mjs?v=0.2.0');
  const secondaryButtonStyle = {
    display: 'flex',
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 11,
    paddingBottom: 11,
    paddingLeft: 16,
    paddingRight: 16,
    background: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    color: '#e2e8f0',
    fontSize: 16,
    fontWeight: 600,
    hover: { background: '#283548', borderColor: '#475569' },
    active: { background: '#0f172a' },
  };
  const primaryButtonStyle = {
    display: 'flex',
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 11,
    paddingBottom: 11,
    paddingLeft: 16,
    paddingRight: 16,
    background: '#0284c7',
    borderWidth: 1,
    borderColor: '#38bdf8',
    borderRadius: 8,
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 700,
    hover: { background: '#0ea5e9' },
    active: { background: '#0369a1' },
  };
  const resetButtonStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 11,
    paddingBottom: 11,
    paddingLeft: 20,
    paddingRight: 20,
    background: '#161f30',
    borderWidth: 1,
    borderColor: '#263244',
    borderRadius: 8,
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: 600,
    hover: { background: '#1e293b', color: '#e2e8f0', borderColor: '#334155' },
    active: { background: '#0f172a' },
  };
  const root = await mount({
    title: 'GPUI Web SDK smoke test',
    width: 800,
    height: 520,
    initialState: { count: 0, name: 'World' },
    view: (state, update) => ui.column({
      style: {
        width: '100%',
        height: '100%',
        padding: 32,
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0b0f17',
      },
    }, [
      ui.column({
        style: {
          width: 520,
          padding: 28,
          gap: 20,
          background: '#111827',
          borderWidth: 1,
          borderColor: '#1f2937',
          borderRadius: 14,
          boxShadow: { offsetX: 0, offsetY: 16, blurRadius: 36, spreadRadius: 0, color: '#00000080' },
        },
      }, [
        ui.row({
          style: {
            width: '100%',
            alignItems: 'center',
            justifyContent: 'between',
            paddingBottom: 14,
            borderBottomWidth: 1,
            borderColor: '#1e293b',
          },
        }, [
          ui.column({ style: { gap: 2 } }, [
            ui.text('GPUI / WEBASSEMBLY · SVELTE 5', {
              style: { fontSize: 11, fontWeight: 700, color: '#38bdf8' },
            }),
            ui.text('Native Counter HUD', {
              style: { fontSize: 20, fontWeight: 700, color: '#f8fafc' },
            }),
          ]),
          ui.view({
            style: {
              paddingTop: 4,
              paddingBottom: 4,
              paddingLeft: 10,
              paddingRight: 10,
              background: '#0c1f2e',
              borderWidth: 1,
              borderColor: '#164e63',
              borderRadius: 999,
            },
          }, [
            ui.text('LIVE WASM', { style: { fontSize: 11, fontWeight: 600, color: '#38bdf8' } }),
          ]),
        ]),
        ui.column({ style: { width: '100%', gap: 8 } }, [
          ui.row({ style: { width: '100%', alignItems: 'center', justifyContent: 'between' } }, [
            ui.text('OPERATOR', { style: { fontSize: 11, fontWeight: 600, color: '#94a3b8' } }),
            ui.text('Hello, ' + state.name, { style: { fontSize: 13, fontWeight: 500, color: '#cbd5e1' } }),
          ]),
          ui.input({
            value: state.name,
            placeholder: 'Enter your name',
            onChange: e => update({ name: e.value ?? '' }),
            style: {
              width: '100%',
              paddingTop: 10,
              paddingBottom: 10,
              paddingLeft: 14,
              paddingRight: 14,
              background: '#0b1120',
              borderWidth: 1,
              borderColor: '#263244',
              borderRadius: 8,
              color: '#f1f5f9',
              fontSize: 15,
              hover: { borderColor: '#38bdf8' },
            },
          }),
        ]),
        ui.column({
          style: {
            width: '100%',
            padding: 20,
            gap: 16,
            background: '#0d1422',
            borderWidth: 1,
            borderColor: '#1e293b',
            borderRadius: 10,
          },
        }, [
          ui.row({ style: { width: '100%', alignItems: 'center', justifyContent: 'between' } }, [
            ui.text('COUNTER TELEMETRY', { style: { fontSize: 11, fontWeight: 600, color: '#64748b' } }),
            ui.text('Count: ' + state.count, { style: { fontSize: 30, fontWeight: 700, color: '#f8fafc' } }),
          ]),
          ui.row({ style: { width: '100%', gap: 10 } }, [
            ui.button('\u2212', () => update({ count: state.count - 1 }), { style: secondaryButtonStyle }),
            ui.button('+', () => update({ count: state.count + 1 }), { style: primaryButtonStyle }),
            ui.button('Reset', () => update({ count: 0 }), { style: resetButtonStyle }),
          ]),
        ]),
        ui.text('Native GPUI rendering · keyboard & pointer interaction', {
          style: { fontSize: 12, color: '#64748b' },
        }),
      ]),
    ]),
  });
  window.__root = root; // expose for the documented validation protocol
  const deadline = Date.now() + 15000;
  while (!document.querySelector('canvas') && Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 100));
  }
  if (!document.querySelector('canvas')) {
    throw new Error('GPUI did not create a canvas within 15 seconds');
  }
  // A canvas alone is not proof of a painted tree. Wait for the first native
  // paint, then verify content and an interaction through the automation API.
  let painted = [];
  const paintDeadline = Date.now() + 10000;
  do {
    painted = root.renderer?.getPaintedText?.() ?? [];
    if (painted.some(s => s.includes('Count: 0'))) break;
    await new Promise(r => setTimeout(r, 100));
  } while (Date.now() < paintDeadline);
  if (!painted.some(s => s.includes('Count: 0'))) {
    throw new Error('GPUI canvas exists but no painted tree: ' + JSON.stringify(painted));
  }
  // Native layout settles after the first paint; bounds read before that can
  // be stale, so let one frame pass before resolving the click target.
  await new Promise(r => setTimeout(r, 1000));
  const tree = JSON.parse(root.renderer.getAutomationTree());
  const findButton = (node, label) => {
    if (node.text === label && node.bounds) return node;
    for (const child of node.children || []) {
      const found = findButton(child, label);
      if (found) return found;
    }
    return null;
  };
  const plus = findButton(tree, '+');
  if (!plus?.bounds) throw new Error('GPUI automation tree has no + button bounds');
  root.renderer.simulateClick(
    plus.bounds.x + plus.bounds.width / 2,
    plus.bounds.y + plus.bounds.height / 2,
    0
  );
  let changed = false;
  const clickDeadline = Date.now() + 5000;
  while (Date.now() < clickDeadline) {
    painted = root.renderer.getPaintedText();
    if (painted.some(s => s.includes('Count: 1'))) { changed = true; break; }
    await new Promise(r => setTimeout(r, 100));
  }
  if (!changed) throw new Error('GPUI + did not update painted text: ' + JSON.stringify(painted));
  status.remove();
} catch (error) {
  status.classList.add('error');
  status.textContent = 'GPUI initialization failed: ' + (error?.message ?? String(error));
  console.error(error);
}