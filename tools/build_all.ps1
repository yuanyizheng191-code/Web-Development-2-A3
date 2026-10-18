# =============================================================================
# build_all.ps1
# -----------------------------------------------------------------------------
# PROG2002 A3 - team40 - Yizheng Yuan (24833044), Mu Li (224832355)
#
# One command that produces everything needed for submission:
#
#   1. build the Angular client website for production
#   2. build the Angular admin website for production (-base-href /admin/)
#   3. copy both builds into api/public/ so the single cPanel Node.js app
#      serves the API and both websites from one application
#   4. create the three source zips the brief requires
#
# The three project folders are siblings, laid out like this:
#
#   <workspace>\PROG2002-A3\
#     ng-client\     Angular v22 client website
#     ng-admin\      Angular v22 admin website
#     prog2002-a3\   repository root: api\, deploy\, tools\, DEPLOYMENT.md
#     submission\    the generated zips
#
# Usage:
#   & .\tools\build_all.ps1
#   & .\tools\build_all.ps1 -Username 24833044 -NodePath "D:\Node24\node-v24.22.0-win-x64"
#
# Node 22.22.3+ / 24.15+ is required by Angular v22.
# =============================================================================

[CmdletBinding()]
param(
    [string]$Username = "24833044",
    [string]$NodePath = "D:\Node24\node-v24.22.0-win-x64"
)

$ErrorActionPreference = "Stop"

# npm writes harmless warnings to stderr (for example the "Unknown env config
# side-effects-cache" notice).  Windows PowerShell 5.1 turns ANY stderr output
# from a native command into a terminating error once $ErrorActionPreference is
# "Stop", which would abort this script even though the build succeeded.
# "Continue" keeps real failures detectable through $LASTEXITCODE below.
if ($PSVersionTable.PSVersion.Major -lt 7) {
    $ErrorActionPreference = "Continue"
}

# $PSScriptRoot is ...\prog2002-a3\tools, so the repository root is its parent
# and the workspace (which holds ng-client and ng-admin) is one level above that.
$repo = Split-Path -Parent $PSScriptRoot
$workspace = Split-Path -Parent $repo

$clientDir = Join-Path $workspace "ng-client"
$adminDir = Join-Path $workspace "ng-admin"
$apiDir = Join-Path $repo "api"
$public = Join-Path $apiDir "public"
$clientDist = Join-Path $clientDir "dist\clientside\browser"
$adminDist = Join-Path $adminDir "dist\adminside\browser"

$submission = Join-Path $workspace "submission"

Write-Host ""
Write-Host "  PROG2002 A3 - full build" -ForegroundColor Cyan
Write-Host "  repository : $repo"
Write-Host "  workspace  : $workspace"
Write-Host ""

# --- sanity check the layout -------------------------------------------------
foreach ($dir in @($clientDir, $adminDir, $apiDir)) {
    if (-not (Test-Path $dir)) {
        throw "Expected folder not found: $dir`nRun this script from the prog2002-a3\tools folder of the project."
    }
}

# --- make sure an Angular-capable Node is used -------------------------------
if (Test-Path $NodePath) {
    $env:Path = "$NodePath;" + $env:Path
}
$nodeVersion = (& node -v).TrimStart('v')
Write-Host "  node $nodeVersion"
$minimum = [version]"22.22.3"
if ([version]$nodeVersion -lt $minimum) {
    Write-Warning "Angular v22 requires Node 22.22.3+ (or 24.15+). Found $nodeVersion."
    Write-Warning "Pass -NodePath with a newer Node folder, e.g. -NodePath 'D:\Node24\node-v24.22.0-win-x64'"
}

# --- 1 + 2: production builds ------------------------------------------------
Write-Host ""
Write-Host "  [1/4] Building the client website..." -ForegroundColor Yellow
Push-Location $clientDir
try {
    & npx ng build --configuration production
    if ($LASTEXITCODE -ne 0) { throw "The client build failed." }
} finally { Pop-Location }

Write-Host ""
Write-Host "  [2/4] Building the admin website..." -ForegroundColor Yellow
Push-Location $adminDir
try {
    # The admin site is hosted under /admin, so the base href must match or the
    # browser would request its assets from the wrong path.
    & npx ng build --configuration production --base-href /admin/
    if ($LASTEXITCODE -ne 0) { throw "The admin build failed." }
} finally { Pop-Location }

# --- 3: assemble the cPanel public folder -----------------------------------
Write-Host ""
Write-Host "  [3/4] Copying the builds into api\public..." -ForegroundColor Yellow
foreach ($pair in @(@($clientDist, (Join-Path $public "client")), @($adminDist, (Join-Path $public "admin")))) {
    $from = $pair[0]
    $to = $pair[1]
    if (-not (Test-Path $from)) { throw "Build output not found: $from" }
    if (Test-Path $to) { Remove-Item -LiteralPath $to -Recurse -Force }
    New-Item -ItemType Directory -Force -Path $to | Out-Null
    Copy-Item -Path (Join-Path $from "*") -Destination $to -Recurse -Force
    Write-Host "      $from"
    Write-Host "        -> $to"
}

# cPanel needs the rewrite rules inside the deployed folders.
Copy-Item (Join-Path $repo "deploy\client.htaccess") (Join-Path $public "client\.htaccess") -Force
Copy-Item (Join-Path $repo "deploy\admin.htaccess") (Join-Path $public "admin\.htaccess") -Force
Write-Host "      .htaccess placed in public\client and public\admin"

# --- 4: the three submission zips -------------------------------------------
Write-Host ""
Write-Host "  [4/4] Creating the submission archives..." -ForegroundColor Yellow
& python (Join-Path $PSScriptRoot "package_zips.py") $Username
if ($LASTEXITCODE -ne 0) { throw "Packaging failed. Is Python installed and on the PATH?" }

Write-Host "  Done." -ForegroundColor Green
Write-Host ""
Write-Host "  Produced:"
Write-Host "    submission\${Username}A3-clientside.zip"
Write-Host "    submission\${Username}A3-adminside.zip"
Write-Host "    submission\${Username}A3-api.zip"
Write-Host "    api\public\client  +  api\public\admin   (for the cPanel deployment)"
Write-Host ""
Write-Host "  Verify the combined deployment locally:"
Write-Host "    cd `"$apiDir`""
Write-Host "    node server.js"
Write-Host "    then open  http://localhost:3000/  and  http://localhost:3000/admin/"
Write-Host ""
