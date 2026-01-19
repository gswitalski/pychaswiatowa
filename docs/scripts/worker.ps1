# Worker Test Script
# NOTE: Functions must be run with --no-verify-jwt flag

Write-Host "Calling normalized ingredients worker..." -ForegroundColor Cyan

$response = Invoke-RestMethod -Uri "http://localhost:54331/functions/v1/internal/workers/normalized-ingredients/run" `
  -Method POST `
  -Headers @{
    "Content-Type" = "application/json"
    "x-internal-worker-secret" = "dev-test-secret"
  }

Write-Host "`nWorker Response:" -ForegroundColor Green
$response | ConvertTo-Json -Depth 10

Write-Host "`nSummary:" -ForegroundColor Yellow
Write-Host "  Processed: $($response.processed)"
Write-Host "  Succeeded: $($response.succeeded)"
Write-Host "  Failed: $($response.failed)"
Write-Host "  Skipped: $($response.skipped)"
