$files = @(
    (git diff --name-only),
    (git ls-files --others --exclude-standard)
) | Where-Object { $_ }

$messages = @()
if ($files -match '^supabase/functions/') {
    if (Get-Command deno -ErrorAction SilentlyContinue) {
        $functions = $files |
            Where-Object { $_ -match '^supabase/functions/([^/]+)/' } |
            ForEach-Object { [regex]::Match($_, '^supabase/functions/([^/]+)/').Groups[1].Value } |
            Sort-Object -Unique
        foreach ($function in $functions) {
            deno check "supabase/functions/$function/index.ts"
            if ($LASTEXITCODE -ne 0) { $messages += "deno check nie przeszedł dla $function" }
        }
    } else {
        $messages += 'Deno nie jest dostępne w PATH; pominięto deno check.'
    }
}
if ($files -match '^(src|shared)/') {
    npm run lint
    if ($LASTEXITCODE -ne 0) { $messages += 'npm run lint nie przeszedł.' }
    npm run test:run
    if ($LASTEXITCODE -ne 0) { $messages += 'npm run test:run nie przeszedł.' }
}
if ($messages.Count -gt 0) {
    @{ followup_message = "Weryfikacja nie przeszła:`n$($messages -join "`n")`nPopraw błędy i zakończ ponownie." } | ConvertTo-Json -Compress
} else {
    '{}' 
}
