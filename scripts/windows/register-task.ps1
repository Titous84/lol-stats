<#
    .SYNOPSIS
    Enregistre (ou remplace) la tache planifiee d'ingestion lol-stats.
    TASKS.md paragraphe L2.

    .DESCRIPTION
    Toutes les 30 minutes, indefiniment, meme si aucune session utilisateur
    n'est ouverte (LogonType S4U : pas de mot de passe stocke, s'execute hors
    session interactive). "Executer des que possible apres un demarrage
    manque" est active. MultipleInstances=IgnoreNew empeche l'empilement au
    niveau du Planificateur, en plus du verrou applicatif deja present dans
    scripts/ingest/lock.ts.

    Idempotent : relancer ce script remplace la tache existante plutot que
    d'echouer ou d'en creer une deuxieme.

    .PARAMETER WhatIf
    Affiche ce qui serait fait sans toucher au Planificateur de taches.

    .PARAMETER TaskName
    Nom de la tache dans le Planificateur. Par defaut "lol-stats - ingestion".

    .EXAMPLE
    .\scripts\windows\register-task.ps1 -WhatIf

    .EXAMPLE
    .\scripts\windows\register-task.ps1
#>
[CmdletBinding()]
param(
    [string]$TaskName = "lol-stats - ingestion",
    [switch]$WhatIf
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Path (Split-Path -Path $PSScriptRoot -Parent) -Parent
$RunScript = Join-Path $PSScriptRoot "run-ingest.ps1"

if (-not (Test-Path $RunScript)) {
    throw "run-ingest.ps1 introuvable a $RunScript"
}

$ActionArgs = "-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$RunScript`""
$Description = "lol-stats : ingestion incrementale des matchs ranked (420/440) via l'API Riot. " +
    "Genere par scripts/windows/register-task.ps1 -- ne pas editer a la main dans le Planificateur."

Write-Host "Tache          : $TaskName"
Write-Host "Executable     : powershell.exe"
Write-Host "Arguments      : $ActionArgs"
Write-Host "Declencheur    : toutes les 30 min, indefiniment, rattrapage active"
Write-Host "Compte         : $env:USERDOMAIN\$env:USERNAME (LogonType S4U -- sans session ouverte)"
Write-Host "Empilement     : MultipleInstances=IgnoreNew (+ verrou applicatif)"

$existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue

if ($WhatIf) {
    if ($existing) {
        Write-Host ""
        Write-Host "[WhatIf] Une tache '$TaskName' existe deja (etat: $($existing.State)) -- serait remplacee."
    } else {
        Write-Host ""
        Write-Host "[WhatIf] Aucune tache existante -- serait creee."
    }
    Write-Host "[WhatIf] Aucune modification effectuee."
    exit 0
}

$Action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $ActionArgs

# [TimeSpan]::MaxValue depasse la duree maximale acceptee par le schema XML
# du Planificateur (P99999999DT23H59M59S -> rejete). 10 ans est la valeur
# idiomatique pour simuler "indefiniment" avec ce cmdlet.
$Trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) `
    -RepetitionInterval (New-TimeSpan -Minutes 30) `
    -RepetitionDuration (New-TimeSpan -Days 3650)

$Principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType S4U -RunLevel Limited

$Settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -MultipleInstances IgnoreNew `
    -ExecutionTimeLimit (New-TimeSpan -Hours 1)

if ($existing) {
    Write-Host ""
    Write-Host "Tache existante trouvee -- remplacement (idempotent)."
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger `
    -Principal $Principal -Settings $Settings -Description $Description -ErrorAction Stop | Out-Null

if (-not (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue)) {
    throw "Register-ScheduledTask n'a signale aucune erreur mais la tache '$TaskName' n'existe pas -- verification post-enregistrement echouee."
}

Write-Host ""
Write-Host "Tache '$TaskName' enregistree."
Write-Host "Verification : Get-ScheduledTaskInfo -TaskName '$TaskName'"
Write-Host "Desinscription : Unregister-ScheduledTask -TaskName '$TaskName' -Confirm:`$false"
