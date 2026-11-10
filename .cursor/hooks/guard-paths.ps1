$payload = [Console]::In.ReadToEnd() | ConvertFrom-Json
$toolInput = $payload.tool_input
$raw = if ($toolInput -is [string]) { $toolInput } else { $payload | ConvertTo-Json -Depth 20 -Compress }
$path = [string]$toolInput.path
if ([string]::IsNullOrWhiteSpace($path)) { $path = [string]$toolInput.file_path }
if ([string]::IsNullOrWhiteSpace($path)) { $path = [string]$toolInput.target_file }
if ([string]::IsNullOrWhiteSpace($path)) { $path = $raw }

if ($path -match '(^|["''/\\:])doc[\\/]') {
    @{ permission = 'deny'; agent_message = 'Użyj docs/results zgodnie z ps-feature-conventions, nie doc/.' } | ConvertTo-Json -Compress
    exit 0
}
if ($path -match '(^|[\\/])(\.env($|[\\/])|\.env\.)|environment\.production\.ts') {
    @{ permission = 'deny'; agent_message = 'Pliki środowiskowe i produkcyjne są chronione.' } | ConvertTo-Json -Compress
    exit 0
}
if ($path -match 'docs[\\/]prompts[\\/]') {
    @{ permission = 'deny'; agent_message = 'Stare prompty są archiwum i nie powinny być modyfikowane.' } | ConvertTo-Json -Compress
    exit 0
}
@{ permission = 'allow' } | ConvertTo-Json -Compress
