param(
    [ValidateSet('api', 'views')]
    [string]$Stage = 'api',
    [switch]$Migrations
)

# Preflight środowiska dla etapu implementacji. Krótki raport tekstowy; zawsze exit 0.
$ErrorActionPreference = 'Continue'
Set-Location (Join-Path $PSScriptRoot '..\..')

$missing = [System.Collections.Generic.List[string]]::new()
$lines = [System.Collections.Generic.List[string]]::new()

function Get-ToolVersion {
    param([string]$Name, [string[]]$VersionArgs)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) { return $null }
    $global:LASTEXITCODE = 0
    $out = & $Name @VersionArgs 2>&1 | Out-String
    return (($out -split "`r?`n" | Where-Object { $_.Trim() } | Select-Object -First 1)).Trim()
}

function Test-Port {
    param([int]$Port)
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $task = $client.ConnectAsync('127.0.0.1', $Port)
        return $task.Wait(500) -and $client.Connected
    } catch {
        return $false
    } finally {
        $client.Dispose()
    }
}

if ($Stage -eq 'views') {
    $node = Get-ToolVersion 'node' @('--version')
    if (-not $node) { $missing.Add('node') }
    if (-not (Test-Path 'node_modules')) { $missing.Add('node_modules (npm install)') }
    $lines.Add("Node: $(if ($node) { $node } else { 'BRAK' }); node_modules: $(if (Test-Path 'node_modules') { 'TAK' } else { 'NIE' })")
}

if ($Stage -eq 'api') {
    $deno = Get-ToolVersion 'deno' @('--version')
    $supabase = Get-ToolVersion 'supabase' @('--version')
    $dockerOk = $false
    if (Get-Command docker -ErrorAction SilentlyContinue) {
        docker info *> $null
        $dockerOk = ($LASTEXITCODE -eq 0)
    }
    if (-not $deno) { $missing.Add('deno') }
    if (-not $supabase) { $missing.Add('supabase CLI') }
    if (-not $dockerOk) { $missing.Add('docker (niedostępny lub wyłączony)') }
    $lines.Add("Deno: $(if ($deno) { $deno } else { 'BRAK' })")
    $lines.Add("Supabase CLI: $(if ($supabase) { $supabase } else { 'BRAK' })")
    $lines.Add("Docker: $(if ($dockerOk) { 'działa' } else { 'niedostępny' })")

    $ports = [ordered]@{}
    $section = ''
    foreach ($line in (Get-Content 'supabase/config.toml' -Encoding UTF8)) {
        if ($line -match '^\[(.+)\]\s*$') { $section = $Matches[1]; continue }
        if ($line -match '^port\s*=\s*(\d+)' -and $section -in @('api', 'db', 'studio', 'local_smtp')) {
            $ports[$section] = [int]$Matches[1]
        }
    }
    $portText = ($ports.GetEnumerator() | ForEach-Object { "$($_.Key)=$($_.Value)" }) -join ' '
    $up = if ($ports['api']) { Test-Port $ports['api'] } else { $false }
    $lines.Add("Porty (config.toml): $portText; stos lokalny: $(if ($up) { 'działa' } else { 'nie działa (supabase start)' })")

    $keys = @()
    if (Test-Path '.env.local') {
        $keys = Get-Content '.env.local' -Encoding UTF8 | ForEach-Object { ($_ -split '=', 2)[0].Trim() }
    }
    $hasUser = ($keys -contains 'TEST_USER_EMAIL') -and ($keys -contains 'TEST_USER_PASSWORD')
    $hasAdmin = ($keys -contains 'TEST_ADMIN_EMAIL') -and ($keys -contains 'TEST_ADMIN_PASSWORD')
    $lines.Add("Konta testowe w .env.local (smoke): user=$(if ($hasUser) { 'TAK' } else { 'NIE' }) admin=$(if ($hasAdmin) { 'TAK' } else { 'NIE' })")
    if (-not ($hasUser -and $hasAdmin)) {
        $lines.Add('Smoke test z kontami: WYMAGA_WERYFIKACJI (brak kont); odpowiedź 4xx z kodu funkcji nadal sprawdzisz skryptem smoke-functions.ps1')
    }

    if ($Migrations -and $supabase -and $up) {
        $global:LASTEXITCODE = 0
        $raw = supabase migration list --local 2>&1 | Out-String
        $drift = @()
        foreach ($row in ($raw -split "`r?`n")) {
            if ($row -notmatch '\|') { continue }
            $cells = $row -split '\|' | ForEach-Object { $_.Trim() }
            if ($cells.Count -lt 2) { continue }
            if ($cells[0] -match '^\d{8,}$') { continue }
            if (($cells[1] -match '^\d{8,}$') -and -not $cells[0]) { $drift += $cells[1] }
        }
        $lines.Add("Dryf migracji lokalnych (wersje w bazie spoza repo): $(if ($drift) { $drift -join ', ' } else { 'brak' })")
        if ($drift) { $missing.Add('dryf migracji — zapytaj użytkownika przed resetem lub migracją') }
    }
}

$lines | ForEach-Object { Write-Output $_ }
if ($missing.Count -gt 0) {
    Write-Output "Status: WYMAGA_WERYFIKACJI (brakuje: $($missing -join '; '))"
} else {
    Write-Output 'Status: PASS'
}
exit 0
