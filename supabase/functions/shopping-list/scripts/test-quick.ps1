# Quick test script for shopping-list endpoint

Write-Host "=== Shopping List Endpoint Test ===" -ForegroundColor Cyan
Write-Host ""

# Test 1: Without auth (should return 401)
Write-Host "Test 1: POST without Authorization header" -ForegroundColor Yellow
try {
    $body = @{text="test without auth"} | ConvertTo-Json
    $response = Invoke-WebRequest -Uri "http://localhost:54331/functions/v1/shopping-list/items" `
        -Method POST -Body $body -ContentType "application/json" -UseBasicParsing -ErrorAction Stop
    Write-Host "✅ Status: $($response.StatusCode)" -ForegroundColor Green
} catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 401) {
        Write-Host "✅ Status: 401 (Expected - Unauthorized)" -ForegroundColor Green
        Write-Host "   Response: $($_.ErrorDetails.Message)" -ForegroundColor Gray
    } else {
        Write-Host "❌ Unexpected status: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "---" -ForegroundColor Gray
Write-Host ""

# Test 2: With auth (requires manual JWT token)
Write-Host "Test 2: POST with Authorization (needs JWT token)" -ForegroundColor Yellow
Write-Host "To test with auth, you need to:" -ForegroundColor Gray
Write-Host "1. Get JWT token by signing in as test@pychaswiatowa.pl" -ForegroundColor Gray
Write-Host "2. Use the test-requests.http file with REST Client extension" -ForegroundColor Gray
Write-Host ""
Write-Host "Or run this command with your token:" -ForegroundColor Gray
Write-Host '$token = "YOUR_JWT_TOKEN_HERE"' -ForegroundColor DarkGray
Write-Host '$body = @{text="mleko"} | ConvertTo-Json' -ForegroundColor DarkGray
Write-Host 'Invoke-WebRequest -Uri "http://localhost:54331/functions/v1/shopping-list/items" -Method POST -Body $body -ContentType "application/json" -Headers @{Authorization="Bearer $token"} -UseBasicParsing' -ForegroundColor DarkGray

Write-Host ""
Write-Host "=== Test Complete ===" -ForegroundColor Cyan
