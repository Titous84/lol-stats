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
$LogRetentionDays = 30

$ProjectRoot = Split-Path -Path (Split-Path -Path $PSScriptRoot -Parent) -Parent
$LogDir = Join-Path $ProjectRoot "data\logs"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

$LogFile = Join-Path $LogDir ("ingest-{0}.log" -f (Get-Date -Format "yyyy-MM-dd"))
$StartedAt = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

"===== $StartedAt - run declenche par le Planificateur =====" |
    Out-File -FilePath $LogFile -Append -Encoding utf8

Set-Location -Path $ProjectRoot

$npmCommand = Get-Command npm -ErrorAction SilentlyContinue
if (-not $npmCommand) {
    "ERREUR ENVELOPPE : npm introuvable dans PATH (contexte du Planificateur)." |
        Out-File -FilePath $LogFile -Append -Encoding utf8
    exit 10
}

& npm run ingest *>> $LogFile
$exitCode = $LASTEXITCODE

$FinishedAt = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
"===== $FinishedAt - code de sortie $exitCode =====" |
    Out-File -FilePath $LogFile -Append -Encoding utf8

Get-ChildItem -Path $LogDir -Filter "ingest-*.log" -ErrorAction SilentlyContinue |
    Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$LogRetentionDays) } |
    Remove-Item -Force -ErrorAction SilentlyContinue

exit $exitCode
