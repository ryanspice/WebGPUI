[CmdletBinding()]
param(
  [string]$Ref = 'e70735599b5368313f214249ed531ea7623a1fba',
  [string]$Workspace = (Join-Path $PSScriptRoot '.build')
)
# Build the WebGPUI from a pinned upstream revision.
#
# Prerequisites: git, Bun 1.4 (upstream packageManager), Rust/rustup with the
# wasm32-unknown-unknown target, and the wasm-bindgen CLI matching the upstream
# Cargo.toml (this script installs it via `cargo install` if missing).
#
# The script clones upstream into an isolated workspace, builds the upstream
# browser WASM + adapters, bundles the SDK facade (gpui-sites/sdk.mjs) with Vite,
# copies the public docs/examples (gpui-sites-public/*) into dist-sites/gpui,
# stamps the resolved upstream commit + WASM asset list into the manifest, and
# copies license notices. It never edits an existing user repository.
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
function Run([string]$Command, [string[]]$Arguments) {
  & $Command @Arguments
  if ($LASTEXITCODE -ne 0) { throw "$Command failed ($LASTEXITCODE)" }
}
foreach ($tool in 'git','bun','cargo','rustc') { Get-Command $tool -ErrorAction Stop | Out-Null }
$workspacePath = [IO.Path]::GetFullPath($Workspace)
New-Item -ItemType Directory -Force $workspacePath | Out-Null
$repo = Join-Path $workspacePath ('gpui-native-' + [Guid]::NewGuid().ToString('N').Substring(0,8))
Write-Host '[GPUI] Clone isolated upstream checkout' -ForegroundColor Cyan
Run git @('clone','--recurse-submodules','https://github.com/countradooku/gpui-native.git',$repo)
Push-Location $repo
try {
  Run git @('checkout',$Ref)
  Run git @('submodule','update','--init','--recursive')
  $revision = (& git rev-parse HEAD).Trim()
  if ($LASTEXITCODE -ne 0) { throw 'Cannot resolve upstream revision' }
  Write-Host "[GPUI] Upstream $revision" -ForegroundColor Cyan

  # Ensure wasm-bindgen CLI matches the upstream pin.
  $manifest = Get-Content (Join-Path $repo 'crates/gpui-core/Cargo.toml') -Raw
  $pin = [regex]::Match($manifest, 'wasm-bindgen\s*=\s*"=([^"]+)"').Groups[1].Value
  if (-not $pin) { throw 'Cannot read pinned wasm-bindgen version' }
  $have = Get-Command wasm-bindgen -ErrorAction SilentlyContinue
  $ok = $false
  if ($have) { $ok = ((& wasm-bindgen --version) -join '').Trim().EndsWith(" $pin") }
  if (-not $ok) {
    Write-Host "[GPUI] Install wasm-bindgen-cli $pin" -ForegroundColor Cyan
    Run cargo @('install','wasm-bindgen-cli','--version',$pin,'--locked')
  }

  # Overlay the SDK facade + build config into the checkout. Both directories
  # live in this repository; upstream has neither of them.
  Copy-Item (Join-Path $PSScriptRoot 'gpui-sites') $repo -Recurse -Force
  Copy-Item (Join-Path $PSScriptRoot 'gpui-sites-public') $repo -Recurse -Force
  # Apply the recorded fixes for the pinned upstream Svelte/runtime adapters.
  # git apply fails loudly if the pinned revision changes, rather than shipping
  # a silently unpatched build.
  $patch = Join-Path $PSScriptRoot 'gpui-sites/patches/upstream-host-and-compiler.patch'
  if (-not (Test-Path -LiteralPath $patch)) { throw "Missing mandatory upstream patch: $patch" }
  Write-Host '[GPUI] Apply upstream adapter fixes' -ForegroundColor Cyan
  Run git @('apply','--check',$patch)
  Run git @('apply',$patch)
  Run bun @('install','--frozen-lockfile')
  Write-Host '[GPUI] Build upstream WASM and adapters' -ForegroundColor Cyan
  Run bun @('run','build:pages')
  Write-Host '[GPUI] Bundle browser SDK' -ForegroundColor Cyan
  Run bun @('node_modules/vite/bin/vite.js','build','--config','gpui-sites/vite.config.mts')

  # Assemble the static deployment root. Vite emits dist-sites/gpui/v1 (the SDK
  # module + hashed chunks + wasm). The public docs/examples are copied INTO
  # dist-sites/gpui so the relative imports resolve and the public URL has no
  # duplicated `gpui` segment: /dev/gpui/ -> dist-sites/gpui/, /dev/gpui/v1/ ->
  # dist-sites/gpui/v1/, /dev/gpui/examples/counter/ -> dist-sites/gpui/examples/counter/.
  $dist = Join-Path $repo 'dist-sites'
  Copy-Item (Join-Path $repo 'gpui-sites-public/*') (Join-Path $dist 'gpui') -Recurse -Force
  $runtime = Join-Path $dist 'gpui/v1/gpui.mjs'
  if (!(Test-Path $runtime)) { throw 'Missing gpui.mjs' }
  $wasm = @(Get-ChildItem (Join-Path $dist 'gpui/v1') -Filter '*.wasm' -Recurse)
  if ($wasm.Count -eq 0) { throw 'Missing separate WASM asset; inspect Vite build' }
  $manifestPath = Join-Path $dist 'gpui/v1/manifest.json'
  $meta = Get-Content $manifestPath -Raw | ConvertFrom-Json
  $meta | Add-Member -NotePropertyName upstreamRevision -NotePropertyValue $revision -Force
  $meta | Add-Member -NotePropertyName wasmAssets -NotePropertyValue @($wasm | ForEach-Object { [IO.Path]::GetRelativePath((Split-Path $runtime), $_.FullName).Replace('\','/') }) -Force
  $meta | Add-Member -NotePropertyName builtAt -NotePropertyValue (Get-Date).ToString('o') -Force
  $meta | ConvertTo-Json -Depth 10 | Set-Content $manifestPath -Encoding utf8
  # Notices must live inside the published gpui/ tree; only that child is
  # deployed to /dev/gpui/. Keep the dist-sites/ copies for provenance too.
  foreach ($name in 'LICENSE','THIRD_PARTY_NOTICES.md','LICENSES') {
    $source = Join-Path $repo $name
    if (Test-Path $source) {
      Copy-Item $source $dist -Recurse -Force
      Copy-Item $source (Join-Path $dist 'gpui') -Recurse -Force
    }
  }
  # Bundled dependencies need their own notices. Fail loudly if upstream
  # layout changes so we never publish an incomplete attribution set.
  $dependencyNotices = @(
    @{ Source = 'packages/svelte/node_modules/svelte/LICENSE.md'; Name = 'LICENSE-SVELTE.md' },
    @{ Source = 'vendor/gpui-kit/crates/assets/LICENSE-LUCIDE'; Name = 'LICENSE-LUCIDE' }
  )
  foreach ($notice in $dependencyNotices) {
    $source = Join-Path $repo $notice.Source
    if (-not (Test-Path $source)) { throw "Missing required dependency notice: $($notice.Source)" }
    Copy-Item $source (Join-Path (Join-Path $dist 'gpui') $notice.Name) -Force
    Copy-Item $source (Join-Path $dist $notice.Name) -Force
  }
  Write-Host "[GPUI] Static deployment root: $dist" -ForegroundColor Green
  Write-Host '[GPUI] Serve over HTTPS (or localhost); test the native counter and CORS before publishing.'
} finally { Pop-Location }