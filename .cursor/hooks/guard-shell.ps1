$payload = [Console]::In.ReadToEnd() | ConvertFrom-Json
$command = [string]$payload.command

$deny = @(
    'supabase\s+functions\s+deploy',
    'supabase\s+db\s+push',
    'supabase\s+secrets\s+set',
    'firebase\s+deploy',
    'git\s+push\s+.*--force',
    'git\s+reset\s+--hard'
)
$ask = @('supabase\s+db\s+reset', 'git\s+push')

foreach ($pattern in $deny) {
    if ($command -match $pattern) {
        @{ permission = 'deny'; user_message = "Zablokowano: $command"; agent_message = 'Deploy i operacje destrukcyjne wykonuj przez CI lub ręcznie.' } | ConvertTo-Json -Compress
        exit 0
    }
}
foreach ($pattern in $ask) {
    if ($command -match $pattern) {
        @{ permission = 'ask'; user_message = "Potwierdź: $command" } | ConvertTo-Json -Compress
        exit 0
    }
}
@{ permission = 'allow' } | ConvertTo-Json -Compress
