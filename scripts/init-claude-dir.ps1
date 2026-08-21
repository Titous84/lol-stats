<#
.SYNOPSIS
    Cree le dossier .claude\ du projet : les 3 sous-agents + settings.json.

.DESCRIPTION
    Claude Code est ouvert directement dans ce projet. Les sous-agents definis
    dans S:\Claude\.claude\agents\ ne sont donc pas herites : la remontee vers
    les dossiers parents s'arrete a la racine du depot.

    Ce script copie frontend-critic, perf-auditor et qa-tester dans
    .claude\agents\ du projet, et ecrit .claude\settings.json.

    Il existe parce que l'ecriture dans un dossier .claude est bloquee par le
    pont de fichiers distant : cette etape ne pouvait pas etre faite a distance.

.PARAMETER WorkspaceAgents
    Dossier source des sous-agents. Defaut : S:\Claude\.claude\agents

.PARAMETER Force
    Ecrase les fichiers deja presents dans .claude\ du projet.

.EXAMPLE
    cd S:\Claude\Projects\Perso\lol-stats
    .\scripts\init-claude-dir.ps1
#>

[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [string] $WorkspaceAgents = 'S:\Claude\.claude\agents',
    [switch] $Force
)

$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$claudeDir   = Join-Path $projectRoot '.claude'
$agentsDir   = Join-Path $claudeDir  'agents'

Write-Host ''
Write-Host 'Initialisation de .claude\ pour lol-stats' -ForegroundColor Cyan
Write-Host ('-' * 60)
Write-Host "  Projet : $projectRoot"
Write-Host "  Source : $WorkspaceAgents"
Write-Host ''

if (-not (Test-Path -LiteralPath $WorkspaceAgents)) {
    throw "Sous-agents introuvables : $WorkspaceAgents"
}

foreach ($d in @($claudeDir, $agentsDir)) {
    if (-not (Test-Path -LiteralPath $d)) {
        if ($PSCmdlet.ShouldProcess($d, 'Creer le dossier')) {
            New-Item -ItemType Directory -Path $d -Force | Out-Null
        }
    }
}

$expected = @('frontend-critic', 'perf-auditor', 'qa-tester')
$copied = 0

foreach ($name in $expected) {
    $src = Join-Path $WorkspaceAgents "$name.md"
    $dst = Join-Path $agentsDir     "$name.md"

    if (-not (Test-Path -LiteralPath $src)) {
        Write-Host "  [!]     $name.md absent de la source." -ForegroundColor Yellow
        continue
    }
    if ((Test-Path -LiteralPath $dst) -and -not $Force) {
        Write-Host "  [passe] $name.md existe deja (-Force pour ecraser)." -ForegroundColor DarkGray
        continue
    }
    if ($PSCmdlet.ShouldProcess($dst, 'Copier')) {
        Copy-Item -LiteralPath $src -Destination $dst -Force
        Write-Host "  [ok]    $name.md" -ForegroundColor Green
        $copied++
    }
}

# settings.json du projet
$settingsPath = Join-Path $claudeDir 'settings.json'
$settings = @'
{
  "permissions": {
    "allow": [
      "Bash(npm run:*)",
      "Bash(npx tsx:*)",
      "Bash(npx drizzle-kit:*)",
      "Bash(npx vitest:*)",
      "Bash(npx playwright test:*)",
      "Bash(sqlite3 ./data/lol-stats.db:*)"
    ],
    "deny": [
      "Read(./.env.local)",
      "Read(./.env)"
    ]
  }
}
'@

if ((Test-Path -LiteralPath $settingsPath) -and -not $Force) {
    Write-Host '  [passe] settings.json existe deja (-Force pour ecraser).' -ForegroundColor DarkGray
} elseif ($PSCmdlet.ShouldProcess($settingsPath, 'Ecrire')) {
    Set-Content -LiteralPath $settingsPath -Value $settings -Encoding UTF8
    Write-Host '  [ok]    settings.json' -ForegroundColor Green
}

Write-Host ''
Write-Host ('-' * 60)
Write-Host "$copied sous-agent(s) copie(s)." -ForegroundColor Cyan
Write-Host 'Verification : /agents dans Claude Code doit lister frontend-critic,' -ForegroundColor Cyan
Write-Host 'perf-auditor et qa-tester.' -ForegroundColor Cyan
Write-Host ''
