"""Validate the WebGPUI public overlay (docs, example, manifest, guide).

These tests do not require a compiled WASM build. They guard the static
endpoint contract that the deploy pipeline ships under /dev/gpui/.
"""
import json
import re
from pathlib import Path
import unittest

ROOT = Path(__file__).parents[1]
PUBLIC = ROOT / 'gpui-sites-public'
MANIFEST = json.loads((PUBLIC / 'v1' / 'manifest.json').read_text(encoding='utf-8'))

EXPECTED_EXPORTS = ['mount', 'ui', 'initGpuiWeb', 'resetRender', 'version']


class GpuiPublicContractTests(unittest.TestCase):
    def test_manifest_lists_verified_exports(self):
        self.assertEqual(MANIFEST['version'], '0.3.1')
        self.assertEqual(MANIFEST['module'], './gpui.mjs')
        self.assertEqual(MANIFEST['sharedMemoryRequired'], False)
        self.assertEqual(MANIFEST['framework'], 'svelte')
        self.assertEqual(MANIFEST['requires'], ['WebGL2', 'WebAssembly'])
        self.assertEqual(MANIFEST['demo'], '../examples/counter/')
        self.assertEqual(MANIFEST['agentGuide'], '../llms.txt')
        for export in EXPECTED_EXPORTS:
            self.assertIn(export, MANIFEST['exports'])

    def test_manifest_has_no_stale_upstream_fields(self):
        # The build script stamps the real commit; the source manifest must not
        # ship a placeholder pretending to be a resolved revision.
        self.assertNotIn('upstreamRevision', MANIFEST)
        self.assertEqual(MANIFEST['upstream'], 'https://github.com/countradooku/gpui-native')

    def test_counter_imports_absolute_sdk_path(self):
        demo = (PUBLIC / 'examples' / 'counter' / 'demo.mjs').read_text(encoding='utf-8')
        self.assertIn("import('../../v1/gpui.mjs?v=0.3.1')", demo)
        self.assertIn('mount(', demo)
        self.assertIn('ui.column', demo)
        self.assertIn('ui.input', demo)
        self.assertIn('ui.button', demo)
        self.assertIn('update({ count:', demo)

    def test_counter_has_explicit_failure_diagnostic(self):
        demo = (PUBLIC / 'examples' / 'counter' / 'demo.mjs').read_text(encoding='utf-8')
        self.assertIn('GPUI initialization failed', demo)

    def test_landing_page_documents_absolute_import_url(self):
        html = (PUBLIC / 'index.html').read_text(encoding='utf-8')
        self.assertIn('./v1/gpui.mjs', html)
        self.assertIn('Native GPUI', html)
        self.assertIn('mount(', html)

    def test_landing_page_has_real_gpui_renderer_toggle(self):
        html = (PUBLIC / 'index.html').read_text(encoding='utf-8')
        self.assertIn('id="modeHtml" aria-pressed="false"', html)
        self.assertIn('id="modeGpui" aria-pressed="true"', html)
        self.assertIn('id="gpuiLoader"', html)
        self.assertIn('gpui-spinner', html)
        self.assertIn("setMode('gpui')", html)
        self.assertIn('id="htmlPanel"', html)
        self.assertIn('class="gpui-stage"', html)
        self.assertIn("import('./landing-gpui.mjs?v=0.3.1')", html)

        demo = (PUBLIC / 'landing-gpui.mjs').read_text(encoding='utf-8')
        self.assertIn("from './v1/gpui.mjs?v=0.3.1'", demo)
        for descriptor in ('ui.column', 'ui.row', 'ui.view', 'ui.text', 'ui.button'):
            self.assertIn(descriptor, demo)
        for content in ('Native GPUI, on the web.', 'Import it', 'Endpoints', 'Requirements'):
            self.assertIn(content, demo)
        self.assertIn('stage.appendChild(canvas)', demo)
        self.assertIn("window.addEventListener('resize'", demo)
        self.assertIn('HYSTERESIS', demo)
        self.assertIn('slack per card', demo)
        self.assertIn('getPaintedText', demo)
        self.assertNotIn("createElement('canvas')", demo)

    def test_llms_guide_uses_absolute_import_example(self):
        guide = (PUBLIC / 'llms.txt').read_text(encoding='utf-8')
        self.assertIn('https://ryanspice.com/dev/gpui/v1/gpui.mjs?v=0.3.1', guide)
        self.assertIn('ui.button', guide)
        self.assertIn('WebGPU', guide)
        self.assertIn('Svelte', guide)

    def test_sdk_facade_exports_verified_surface(self):
        sdk = (ROOT / 'gpui-sites' / 'sdk.mjs').read_text(encoding='utf-8')
        for export in EXPECTED_EXPORTS:
            self.assertRegex(sdk, rf'\b{re.escape(export)}\b')
        self.assertIn("from '@gpui-native/svelte/web'", sdk)
        # No React in the SDK dependency graph (a "not React" comment is fine).
        self.assertNotRegex(sdk, r"\bfrom\s+['\"]react['\"]")
        self.assertNotIn('react-reconciler', sdk)

    def test_types_declares_facade(self):
        types = (PUBLIC / 'v1' / 'types.d.ts').read_text(encoding='utf-8')
        self.assertIn('export declare function mount', types)
        self.assertIn('export declare const ui', types)

    def test_host_renders_single_descriptor_without_shadowing_snippet(self):
        # The shipped demos return one ui.* descriptor from view(). Normalize it
        # to an array, and never name the each item `node` (that shadows the
        # `node` snippet and produces "TypeError: e is not a function").
        host = (ROOT / 'gpui-sites' / 'Host.svelte').read_text(encoding='utf-8')
        self.assertIn('Array.isArray(nodes)', host)
        self.assertIn('{#each items as item}', host)
        self.assertIn('{@render node(item)}', host)

    def test_facade_hardening_contract(self):
        sdk = (ROOT / 'gpui-sites' / 'sdk.mjs').read_text(encoding='utf-8')
        self.assertIn('gpuiProps', sdk)  # both bare and {style:...} forms work
        self.assertIn('mount() already called', sdk)
        self.assertIn('onError?.(error)', sdk)
        self.assertIn('GPUI Web requires WebGL2', sdk)
        self.assertIn('export function resetRender', sdk)
        # The mount slot must be reserved before the first await.
        self.assertEqual(sdk.count('mounted = true;'), 1)
        self.assertLess(sdk.index('mounted = true;'), sdk.index('await initGpuiWeb()'))
        # Ownership token prevents reset/mount races from unlocking a newer root.
        self.assertIn('let generation = 0;', sdk)
        self.assertIn('const token = ++generation;', sdk)
        self.assertIn('const isOwner = () => token === generation;', sdk)
        self.assertIn('mount was reset during initialization', sdk)

        host = (ROOT / 'gpui-sites' / 'Host.svelte').read_text(encoding='utf-8')
        self.assertIn('$derived.by', host)
        self.assertIn('onError?.(error)', host)
        self.assertIn('readyFired', host)
        self.assertIn('{...(n.props ?? {})}', host)
        self.assertIn('n === false', host)

    def test_game_demo_is_shipped_and_self_validating(self):
        game = PUBLIC / 'examples' / 'game'
        self.assertTrue((game / 'index.html').is_file())
        demo = (game / 'demo.mjs').read_text(encoding='utf-8')
        self.assertIn("import('../../v1/gpui.mjs?v=0.3.1')", demo)
        self.assertIn('ui.column', demo)
        self.assertIn('Score: ', demo)
        self.assertIn('getPaintedText', demo)
        self.assertIn('simulateClick', demo)

    def test_compare_and_stats_pages_are_shipped(self):
        compare = PUBLIC / 'examples' / 'compare' / 'index.html'
        stats = PUBLIC / 'examples' / 'stats' / 'index.html'
        self.assertTrue(compare.is_file())
        self.assertTrue(stats.is_file())
        c = compare.read_text(encoding='utf-8')
        s = stats.read_text(encoding='utf-8')
        self.assertIn("import('../../v1/gpui.mjs?v=0.3.1')", c)
        self.assertIn('tabHtml', c)
        self.assertIn('getPaintedText', s)
        self.assertIn('getAutomationTree', s)
        landing = (PUBLIC / 'index.html').read_text(encoding='utf-8')
        self.assertIn('./examples/compare/', landing)
        self.assertIn('./examples/stats/', landing)

    def test_build_applies_upstream_adapter_patch(self):
        patch = ROOT / 'gpui-sites' / 'patches' / 'upstream-host-and-compiler.patch'
        self.assertTrue(patch.is_file())
        script = (ROOT / 'Build-WebGPUI.ps1').read_text(encoding='utf-8')
        self.assertIn('upstream-host-and-compiler.patch', script)
        self.assertIn("git @('apply','--check',$patch)", script)
        self.assertIn("git @('apply',$patch)", script)
        self.assertIn("Copy-Item (Join-Path $PSScriptRoot 'gpui-sites-public')", script)


if __name__ == '__main__':
    unittest.main()