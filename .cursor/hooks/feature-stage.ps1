param(
    [Parameter(Mandatory = $true)]
    [string]$Id
)

# Ustala etap historyjki PS-N wyłącznie z artefaktów. Zwraca krótki JSON.
$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..\..')

if ($Id -notmatch '^PS-\d+$') {
    throw "Niepoprawne ID '$Id'. Oczekiwano formatu PS-{N}."
}

function Find-One {
    param([string]$Dir, [string]$Filter)
    if (-not (Test-Path $Dir)) { return $null }
    return Get-ChildItem -Path $Dir -Filter $Filter -File -ErrorAction SilentlyContinue |
        Select-Object -First 1
}

function Test-LayerSkipped {
    param($PlanFile)
    if (-not $PlanFile) { return $false }
    if ($PlanFile.Length -gt 1500) { return $false }
    $text = Get-Content -Path $PlanFile.FullName -Raw -Encoding UTF8
    return $text -match 'Nie dotyczy'
}

function Get-LastResult {
    param([string]$VerificationPath, [string]$Agent)
    if (-not $VerificationPath -or -not (Test-Path $VerificationPath)) { return 'BRAK' }
    $text = Get-Content -Path $VerificationPath -Raw -Encoding UTF8
    $sections = [regex]::Split($text, '(?m)^## ') | Where-Object { $_ -match [regex]::Escape($Agent) }
    if (-not $sections) { return 'BRAK' }
    $last = @($sections)[-1]
    if ($last -match '\|\s*(FAIL|NIE_WYKONANO|WYMAGA_WERYFIKACJI)\s*\|') { return 'FAIL' }
    return 'PASS'
}

$storyDir = "docs/results/new-features/user-stories/$Id"
$story = Find-One $storyDir "$Id-*-user-story.md"
$apiPlan = Find-One 'docs/results/impl-plans/endpoints' "$Id-*-api-implementation-plan.md"
$viewPlan = Find-One 'docs/results/impl-plans/views' "$Id-*-view-implementation-plan.md"
$verification = Find-One $storyDir "$Id-*-verification.md"
$verificationPath = if ($verification) { $verification.FullName } else { $null }

$slug = $null
if ($story) { $slug = [regex]::Match($story.Name, "^$Id-(.+)-user-story\.md$").Groups[1].Value }

$apiSkipped = Test-LayerSkipped $apiPlan
$viewSkipped = Test-LayerSkipped $viewPlan
$apiResult = Get-LastResult $verificationPath 'ps-api-implementer'
$viewResult = Get-LastResult $verificationPath 'ps-view-implementer'

$summaryHit = $false
$summaryPath = 'docs/results/project-summary.md'
if (Test-Path $summaryPath) {
    # Znacznik wpisu w summary: wiersz tabeli rejestru `| PS-N | ... |`.
    # Zwykła wzmianka w tekście nie oznacza ukończenia.
    $marker = "^\|\s*$Id\s*\|"
    $summaryHit = [bool](Select-String -Path $summaryPath -Pattern $marker -Quiet -Encoding UTF8)
}

$stage = 'analiza'
$note = ''
if ($story) {
    $stage = 'plany'
    $missing = @()
    if (-not $apiPlan) { $missing += 'plan API' }
    if (-not $viewPlan) { $missing += 'plan widoków' }
    $note = if ($missing) { 'brakuje: ' + ($missing -join ', ') } else { '' }
    if (-not $missing) {
        $stage = 'implementacja-api'
        if ($apiSkipped -or $apiResult -eq 'PASS') {
            $stage = 'implementacja-widokow'
            if ($viewSkipped -or $viewResult -eq 'PASS') { $stage = 'summary' }
        }
        # Wpis w summary powstaje na końcu procesu, więc ma pierwszeństwo (także dla historyjek
        # zrealizowanych przed hookiem weryfikacji, bez artefaktu verification).
        if ($summaryHit) { $stage = 'zakonczone' }
        if ($stage -eq 'implementacja-api' -and $apiResult -eq 'FAIL') { $note = 'ostatnia weryfikacja API: FAIL' }
        if ($stage -eq 'implementacja-widokow' -and $viewResult -eq 'FAIL') { $note = 'ostatnia weryfikacja widoków: FAIL' }
    }
}

[pscustomobject]@{
    id = $Id
    slug = $slug
    stage = $stage
    note = $note
    story = if ($story) { $story.FullName } else { $null }
    apiPlan = if ($apiPlan) { $apiPlan.FullName } else { $null }
    viewPlan = if ($viewPlan) { $viewPlan.FullName } else { $null }
    apiSkipped = $apiSkipped
    viewSkipped = $viewSkipped
    apiVerification = $apiResult
    viewVerification = $viewResult
    summaryUpdated = $summaryHit
} | ConvertTo-Json -Compress
