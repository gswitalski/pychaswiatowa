# Generuje docs/results/project-reference.md z kodu: tabele, widoki, RPC, enumy,
# Edge Functions, trasy frontendu, guardy i migracje. Nie edytuj wyniku ręcznie.
$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..\..')

$utf8 = New-Object System.Text.UTF8Encoding $false
$out = [System.Collections.Generic.List[string]]::new()

function Add-Line { param([string]$Text = '') $script:out.Add($Text) }

Add-Line '# PychaŚwiatowa — referencja wygenerowana z kodu'
Add-Line ''
Add-Line "Wygenerowano: $(Get-Date -Format 'yyyy-MM-dd') przez ``.cursor/hooks/generate-reference.ps1``. Nie edytuj ręcznie."
Add-Line 'Źródła: `shared/types/database.types.ts`, `supabase/functions`, `src/app/**/*.routes.ts`,'
Add-Line '`src/app/core/guards`, `supabase/migrations`. Wzorce ścieżek Edge Functions są wyciągnięte'
Add-Line 'z kodu heurystycznie (orientacyjnie): szczegóły sprawdź w `*.handlers.ts`.'
Add-Line ''

# --- Baza danych (schemat public) ---
$typesPath = 'shared/types/database.types.ts'
$lines = [System.IO.File]::ReadAllLines((Resolve-Path $typesPath), [System.Text.Encoding]::UTF8)
$inPublic = $false
$section = ''
$tables = [System.Collections.Generic.List[string]]::new()
$views = [System.Collections.Generic.List[string]]::new()
$functions = [System.Collections.Generic.List[string]]::new()
$enums = [System.Collections.Generic.List[string]]::new()
$i = 0
while ($i -lt $lines.Count) {
    $line = $lines[$i]
    if ($line -match '^  (\w+): \{$') { $inPublic = ($Matches[1] -eq 'public'); $section = ''; $i++; continue }
    if (-not $inPublic) { $i++; continue }
    if ($line -match '^    (Tables|Views|Functions|Enums|CompositeTypes): \{') { $section = $Matches[1]; $i++; continue }
    if ($line -match '^      (\w+): \{$' -and $section -in @('Tables', 'Views')) {
        $name = $Matches[1]
        $cols = @()
        $j = $i + 1
        while ($j -lt $lines.Count -and $lines[$j] -notmatch '^        Row: \{$') { $j++ }
        $j++
        while ($j -lt $lines.Count -and $lines[$j] -notmatch '^        \}$') {
            if ($lines[$j] -match '^          (\w+)\??:') { $cols += $Matches[1] }
            $j++
        }
        $entry = "- ``$name``: $($cols -join ', ')"
        if ($section -eq 'Tables') { $tables.Add($entry) } else { $views.Add($entry) }
        $i = $j
        continue
    }
    if ($line -match '^      (\w+): \{$' -and $section -eq 'Functions') {
        $name = $Matches[1]
        $argNames = @()
        $j = $i + 1
        if ($lines[$j] -match '^        Args: \{$') {
            $j++
            while ($j -lt $lines.Count -and $lines[$j] -notmatch '^        \}$') {
                if ($lines[$j] -match '^          (\w+)\??:') { $argNames += $Matches[1] }
                $j++
            }
        }
        $functions.Add("- ``$name($($argNames -join ', '))``")
        $i = $j
        continue
    }
    if ($line -match '^      (\w+):\s*(.*)$' -and $section -eq 'Enums') {
        $name = $Matches[1]
        $buffer = $Matches[2]
        $j = $i + 1
        while ($j -lt $lines.Count -and $lines[$j] -notmatch '^      \w+:' -and $lines[$j] -notmatch '^    \}') {
            $buffer += ' ' + $lines[$j]
            $j++
        }
        $values = [regex]::Matches($buffer, '"([^"]+)"') | ForEach-Object { $_.Groups[1].Value }
        $enums.Add("- ``$name``: $($values -join ', ')")
        $i = $j
        continue
    }
    $i++
}

Add-Line '## Tabele (public) — kolumny'
Add-Line ''
$tables | Sort-Object | ForEach-Object { Add-Line $_ }
Add-Line ''
Add-Line '## Widoki (public)'
Add-Line ''
$views | Sort-Object | ForEach-Object { Add-Line $_ }
Add-Line ''
Add-Line '## Funkcje RPC (public) — argumenty'
Add-Line ''
$functions | Sort-Object | ForEach-Object { Add-Line $_ }
Add-Line ''
Add-Line '## Enumy'
Add-Line ''
$enums | Sort-Object -Unique | ForEach-Object { Add-Line $_ }
Add-Line ''

# --- Edge Functions ---
Add-Line '## Edge Functions'
Add-Line ''
Add-Line 'Ścieżka: `/functions/v1/{funkcja}`. Metody i wzorce wyciągnięte z kodu handlerów i `index.ts`.'
Add-Line ''
$functionDirs = Get-ChildItem 'supabase/functions' -Directory | Where-Object { $_.Name -ne '_shared' } | Sort-Object Name
foreach ($dir in $functionDirs) {
    $files = Get-ChildItem $dir.FullName -Recurse -Filter '*.ts' -File |
        Where-Object { $_.Name -notmatch '\.(test|spec)\.ts$' }
    $methods = [System.Collections.Generic.SortedSet[string]]::new()
    $patterns = [System.Collections.Generic.SortedSet[string]]::new()
    foreach ($file in $files) {
        $text = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
        foreach ($m in [regex]::Matches($text, "(?:method|req\.method)\s*===\s*'(GET|POST|PUT|PATCH|DELETE)'")) {
            [void]$methods.Add($m.Groups[1].Value)
        }
        foreach ($m in [regex]::Matches($text, '\.match\(\s*(/[^/\n][^\n]*?/[gimsuy]*)\s*\)')) {
            $pattern = $m.Groups[1].Value
            if ($pattern -match 'Bearer|functions\\/v1|\\/functions') { continue }
            [void]$patterns.Add($pattern)
        }
        foreach ($m in [regex]::Matches($text, "(?:path|pathname|subPath)\s*===\s*'(/[^']*)'")) {
            [void]$patterns.Add("'$($m.Groups[1].Value)'")
        }
    }
    $fileNames = ($files | ForEach-Object { $_.Name } | Sort-Object) -join ', '
    Add-Line "### $($dir.Name)"
    Add-Line "- pliki: $fileNames"
    Add-Line "- metody: $(if ($methods.Count) { $methods -join ', ' } else { 'n/d' })"
    if ($patterns.Count -gt 0) { Add-Line "- wzorce ścieżek: $(($patterns | ForEach-Object { '`' + $_ + '`' }) -join ' · ')" }
    Add-Line ''
}

# --- Frontend ---
Add-Line '## Trasy frontendu (`path` z plików `*.routes.ts`, bez zagnieżdżenia)'
Add-Line ''
$routeFiles = Get-ChildItem 'src/app' -Recurse -Filter '*.routes.ts' -File | Sort-Object FullName
foreach ($file in $routeFiles) {
    $text = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
    $paths = [regex]::Matches($text, "path:\s*'([^']*)'") | ForEach-Object { $_.Groups[1].Value } | Select-Object -Unique
    $relative = $file.FullName.Substring((Get-Location).Path.Length + 1).Replace('\', '/')
    Add-Line "- ``$relative``: $((($paths | ForEach-Object { if ($_ -eq '') { '(root)' } else { $_ } }) -join ', '))"
}
Add-Line ''
Add-Line '## Guardy (`src/app/core/guards`)'
Add-Line ''
Get-ChildItem 'src/app/core/guards' -Filter '*.guard.ts' -File | Sort-Object Name |
    ForEach-Object { Add-Line "- ``$($_.Name -replace '\.ts$', '')``" }
Add-Line ''
$pages = Get-ChildItem 'src/app/pages' -Directory | Sort-Object Name | ForEach-Object { $_.Name }
Add-Line ('## Strony (`src/app/pages`): ' + ($pages -join ', '))
Add-Line ''

# --- Migracje ---
$migrations = Get-ChildItem 'supabase/migrations' -Filter '*.sql' -File | Sort-Object Name
Add-Line "## Migracje: $($migrations.Count) plików, ostatnie 5"
Add-Line ''
$migrations | Select-Object -Last 5 | ForEach-Object { Add-Line "- ``$($_.Name)``" }
Add-Line ''

$target = 'docs/results/project-reference.md'
[System.IO.File]::WriteAllText((Join-Path (Get-Location) $target), (($out -join "`n") + "`n"), $utf8)
Write-Output "Zapisano $target ($((Get-Item $target).Length) B)"
