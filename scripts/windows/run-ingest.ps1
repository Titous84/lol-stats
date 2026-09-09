<#
    .SYNOPSIS
    Enveloppe appelee par le Planificateur de taches Windows (TASKS.md § L2).

    .DESCRIPTION
    Se place a la racine du projet, execute `npm run ingest`, journalise la
    sortie dans un fichier date sous data\logs\, purge les journaux de plus de
    30 jours, puis termine avec EXACTEMENT le code de sortie du collecteur
    (docs/ARCHITECTURE.md paragraphe 9) :

      0 succes (y compris "rien de nouveau" et "deja en cours")
      2 configuration invalide
      3 cle API expiree ou refusee   <- signal a surveiller chaque matin
      4 rate limit non resorbe
      1 erreur inattendue

    Un code >= 10 signale un probleme dans l'enveloppe elle-meme (npm
    introuvable), pas dans le collecteur.

    Le verrou applicatif (scripts/ingest/lock.ts, frais < 2h) empeche deja
    l'empilement si un run deborde des 30 minutes : cette enveloppe n'a pas
    besoin de son propre verrou.

    ASCII pur volontairement (pas d'accents, pas de tiret cadratin) : les
    scripts .ps1 sans BOM sont mal relus par Windows PowerShell 5.1, qui
    corrompt alors les caracteres non-ASCII dans les chaines executees.
#>

$ErrorActionPreference = "Stop"

# Sorties en UTF-8 sans BOM : sinon Windows PowerShell 5.1 decode le stdout de
# node (UTF-8) via la code page OEM de la console et corrompt les accents, et
# l'operateur *>> ecrit le fichier en UTF-16LE.
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
$OutputEncoding = [System.Text.UTF8Encoding]::new()
$Utf8NoBom = [System.Text.UTF8Encoding]::new($false)

$LogRetentionDays = 30

$ProjectRoot = Split-Path -Path (Split-Path -Path $PSScriptRoot -Parent) -Parent
$LogDir = Join-Path $ProjectRoot "data\logs"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

$LogFile = Join-Path $LogDir ("ingest-{0}.log" -f (Get-Date -Format "yyyy-MM-dd"))
$StartedAt = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

# Journalisation : UTF-8 sans BOM, append. Remplace Out-File -Encoding utf8
# (qui ecrit un BOM en PS 5.1) et l'operateur *>> (UTF-16LE en PS 5.1).
function Write-Log {
    param([string]$Text = "")
    [System.IO.File]::AppendAllText($LogFile, $Text + [Environment]::NewLine, $Utf8NoBom)
}

Write-Log "===== $StartedAt - run declenche par le Planificateur ====="

Set-Location -Path $ProjectRoot

$npmCommand = Get-Command npm -ErrorAction SilentlyContinue
if (-not $npmCommand) {
    Write-Log "ERREUR ENVELOPPE : npm introuvable dans PATH (contexte du Planificateur)."
    exit 10
}

# Capture-puis-ecriture. $LASTEXITCODE est lu sur la ligne IMMEDIATEMENT
# suivante, avant toute autre instruction. Tout le reste du script lit
# $exitCode, jamais $LASTEXITCODE (qui pourrait changer plus loin).
$out = & npm run ingest *>&1 | Out-String
$exitCode = $LASTEXITCODE
[System.IO.File]::AppendAllText($LogFile, $out, $Utf8NoBom)

$FinishedAt = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
Write-Log "===== $FinishedAt - code de sortie $exitCode ====="

Get-ChildItem -Path $LogDir -Filter "ingest-*.log" -ErrorAction SilentlyContinue |
    Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$LogRetentionDays) } |
    Remove-Item -Force -ErrorAction SilentlyContinue

exit $exitCode
