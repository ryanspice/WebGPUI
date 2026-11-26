// Game HUD smoke test for the P0 facade: native painting, score/health state,
// controlled input and pointer interaction. Imports the absolute SDK entry.
const status = document.querySelector('#status');
try {
  const { mount, ui } = await import('../../v1/gpui.mjs?v=0.3.1');
  const buttonStyle = { padding: 10, background: '#334155', borderRadius: 6 };

  const root = await mount({
    title: 'GPUI game HUD',
    width: 900,
    height: 560,
    initialState: { score: 0, hp: 100, name: 'Player' },
    view: (state, update) => ui.column({
      style: { width: '100%', height: '100%', padding: 28, gap: 14, background: '#111827' },
    }, [
      ui.text('GPUI GAME HUD'),
      ui.input({
        value: state.name,
        placeholder: 'Player name',
        onChange: (e) => update({ name: e.value ?? '' }),
      }),
      ui.text('Player: ' + state.name),
      ui.text('Score: ' + state.score),
      ui.text('HP: ' + state.hp),
      ui.view({ style: { width: Math.max(0, state.hp) * 2, height: 12, background: '#22c55e' } }),
      ui.row({ style: { gap: 12 } }, [
        ui.button('+10', () => update({ score: state.score + 10 }), { style: buttonStyle }),
        ui.button('Hit', () => update({ hp: Math.max(0, state.hp - 10) }), { style: buttonStyle }),
        ui.button('Heal', () => update({ hp: Math.min(100, state.hp + 10) }), { style: buttonStyle }),
        ui.button('Reset', () => update({ score: 0, hp: 100 }), { style: buttonStyle }),
      ]),
      ui.text('Native GPUI canvas — real WASM/WebGL2 rendering.'),
    ]),
  });
  window.__root = root; // documented validation protocol

  const deadline = Date.now() + 15000;
  while (!document.querySelector('canvas') && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 100));
  }
  if (!document.querySelector('canvas')) {
    throw new Error('GPUI did not create a canvas within 15 seconds');
  }
  let painted = [];
  const paintDeadline = Date.now() + 10000;
  do {
    painted = root.renderer?.getPaintedText?.() ?? [];
    if (painted.some((s) => s.includes('Score: 0'))) break;
    await new Promise((r) => setTimeout(r, 100));
  } while (Date.now() < paintDeadline);
  if (!painted.some((s) => s.includes('Score: 0'))) {
    throw new Error('GPUI canvas exists but HUD did not paint: ' + JSON.stringify(painted));
  }
  // Let native layout settle before reading automation bounds.
  await new Promise((r) => setTimeout(r, 1000));
  const tree = JSON.parse(root.renderer.getAutomationTree());
  const find = (node, label) => {
    if (node.text === label && node.bounds) return node;
    for (const child of node.children || []) {
      const hit = find(child, label);
      if (hit) return hit;
    }
    return null;
  };
  const plus = find(tree, '+10');
  if (!plus?.bounds) throw new Error('GPUI automation tree has no +10 button bounds');
  root.renderer.simulateClick(
    plus.bounds.x + plus.bounds.width / 2,
    plus.bounds.y + plus.bounds.height / 2,
    0,
  );
  let changed = false;
  const clickDeadline = Date.now() + 5000;
  while (Date.now() < clickDeadline) {
    painted = root.renderer.getPaintedText();
    if (painted.some((s) => s.includes('Score: 10'))) { changed = true; break; }
    await new Promise((r) => setTimeout(r, 100));
  }
  if (!changed) throw new Error('GPUI +10 did not update HUD: ' + JSON.stringify(painted));
  status.remove();
} catch (error) {
  status.classList.add('error');
  status.textContent = 'GPUI initialization failed: ' + (error?.message ?? String(error));
  console.error(error);
}
