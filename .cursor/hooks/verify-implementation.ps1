$ErrorActionPreference = 'Continue'
$payloadText = [Console]::In.ReadToEnd()

$files = @(git diff --name-only HEAD) + @(git ls-files --others --exclude-standard) |
    Where-Object { $_ }

$results = [System.Collections.Generic.List[object]]::new()
$messages = [System.Collections.Generic.List[string]]::new()

function Invoke-Check {
    param([string]$Name, [scriptblock]$Command)
    $global:LASTEXITCODE = 0
    $output = & $Command 2>&1 | Out-String
    if ($LASTEXITCODE -eq 0) {
        $results.Add([pscustomobject]@{ Name = $Name; Status = 'PASS' })
        return
    }
    $results.Add([pscustomobject]@{ Name = $Name; Status = 'FAIL' })
    $tail = ($output -split "`r?`n" | Where-Object { $_.Trim() } | Select-Object -Last 20) -join "`n"
    $messages.Add("$Name nie przeszedł:`n$tail")
}

if ($files -match '^supabase/functions/') {
    $missing = @('deno', 'supabase', 'docker') |
        Where-Object { -not (Get-Command $_ -ErrorAction SilentlyContinue) }
    if ($missing) {
        foreach ($tool in $missing) { $messages.Add("$tool nie jest dostępne w PATH.") }
        $results.Add([pscustomobject]@{ Name = 'deno check / deno test'; Status = 'NIE_WYKONANO' })
    } else {
        $functionNames = $files |
            Where-Object { $_ -match '^supabase/functions/([^/]+)/' } |
            ForEach-Object { [regex]::Match($_, '^supabase/functions/([^/]+)/').Groups[1].Value } |
            Sort-Object -Unique |
            Where-Object { Test-Path "supabase/functions/$_/index.ts" }
        foreach ($functionName in $functionNames) {
            Invoke-Check "deno check $functionName" { deno check "supabase/functions/$functionName/index.ts" }
        }
        Invoke-Check 'deno test' { deno test --allow-all supabase/functions }
    }
    if ($messages.Count -gt 0) {
        $messages.Add('Nie wykonano smoke testu: uruchom supabase functions serve i wyślij żądanie 4xx/401.')
    }
}

if ($files -match '^(src|shared)/') {
    Invoke-Check 'npm run lint' { npm run lint }
    Invoke-Check 'npm run test:run' { npm run test:run }
    Invoke-Check 'npm run build' { npm run build }
}

$storyId = [regex]::Match($payloadText, 'PS-\d+')
if ($storyId.Success -and $results.Count -gt 0) {
    $storyDir = "docs/results/new-features/user-stories/$($storyId.Value)"
    $story = Get-ChildItem -Path $storyDir -Filter "$($storyId.Value)-*-user-story.md" -ErrorAction SilentlyContinue |
        Select-Object -First 1
    if ($story) {
        $prefix = $story.Name -replace '-user-story\.md$', ''
        $agent = [regex]::Match($payloadText, 'ps-(api|view)-implementer').Value
        $lines = @('', "## $(Get-Date -Format 'yyyy-MM-dd HH:mm') $agent", '', '| Weryfikacja | Wynik |', '|---|---|')
        $lines += $results | ForEach-Object { "| $($_.Name) | $($_.Status) |" }
        Add-Content -Path (Join-Path $storyDir "$prefix-verification.md") -Value $lines -Encoding utf8
    }
}

if ($messages.Count -gt 0) {
    @{ followup_message = "Weryfikacja nie przeszła:`n$($messages -join "`n`n")`nPopraw błędy i zakończ ponownie." } | ConvertTo-Json -Compress
    exit 0
}
'{}'
