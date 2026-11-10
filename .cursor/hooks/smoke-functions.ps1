param(
    [Parameter(Mandatory = $true)]
    [string[]]$Function
)

$ErrorActionPreference = 'Stop'
$processes = @()
try {
    foreach ($tool in @('supabase', 'docker')) {
        if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
            throw "$tool nie jest dostępne w PATH."
        }
    }

    foreach ($name in $Function) {
        $process = Start-Process supabase `
            -ArgumentList @('functions', 'serve', $name, '--no-verify-jwt') `
            -PassThru -WindowStyle Hidden
        $processes += $process

        $url = "http://127.0.0.1:54331/functions/v1/$name"
        $ready = $false
        for ($attempt = 0; $attempt -lt 30; $attempt++) {
            Start-Sleep -Milliseconds 500
            try {
                $response = Invoke-WebRequest -Uri $url -Method GET -SkipHttpErrorCheck
                if ($response.StatusCode -ge 400 -and $response.StatusCode -lt 500) {
                    $ready = $true
                    break
                }
                if ($response.StatusCode -ge 500) {
                    throw "$name zwróciła $($response.StatusCode), worker nie działa poprawnie."
                }
            } catch {
                if ($attempt -eq 29) { throw }
            }
        }
        if (-not $ready) { throw "Brak oczekiwanej odpowiedzi 4xx od $name." }
    }
    Write-Output 'Smoke test Edge Functions: PASS'
} finally {
    foreach ($process in $processes) {
        if (-not $process.HasExited) {
            Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
        }
    }
}
