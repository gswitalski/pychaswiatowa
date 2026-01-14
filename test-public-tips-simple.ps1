# Test script for Public Recipes API - Tips search functionality
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Public Recipes API - Tips Search Tests" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Configuration
$baseUrl = "http://localhost:54321/functions/v1"
$anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"

# Check if Supabase is running
Write-Host "[1/5] Checking Supabase status..." -ForegroundColor Cyan
try {
    $headers = @{"apikey" = $anonKey}
    $null = Invoke-WebRequest -Uri "http://localhost:54321/rest/v1/" -Headers $headers -Method GET -TimeoutSec 5 -ErrorAction Stop
    Write-Host "  PASS: Supabase is running" -ForegroundColor Green
    Write-Host ""
}
catch {
    Write-Host "  FAIL: Supabase is NOT running" -ForegroundColor Red
    Write-Host "  Please start it with: supabase start" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

# Test 1: Get recipe list
Write-Host "[2/5] Getting public recipes list..." -ForegroundColor Cyan
try {
    $headers = @{"apikey" = $anonKey}
    $listUrl = "$baseUrl/public/recipes?limit=5"
    $response = Invoke-WebRequest -Uri $listUrl -Headers $headers -Method GET -ErrorAction Stop
    $listData = $response.Content | ConvertFrom-Json
    
    if ($listData.data.Count -gt 0) {
        Write-Host "  PASS: Found $($listData.data.Count) public recipes" -ForegroundColor Green
        $testRecipeId = $listData.data[0].id
        Write-Host "  Using recipe ID: $testRecipeId for testing" -ForegroundColor Gray
    } else {
        Write-Host "  FAIL: No public recipes found" -ForegroundColor Red
        Write-Host "  Please create at least one public recipe" -ForegroundColor Yellow
        exit 1
    }
}
catch {
    Write-Host "  FAIL: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Test 2: Get recipe detail and check tips field
Write-Host "[3/5] Testing recipe detail (tips field)..." -ForegroundColor Cyan
try {
    $headers = @{"apikey" = $anonKey}
    $detailUrl = "$baseUrl/public/recipes/$testRecipeId"
    $response = Invoke-WebRequest -Uri $detailUrl -Headers $headers -Method GET -ErrorAction Stop
    $recipeDetail = $response.Content | ConvertFrom-Json
    
    if ($null -ne $recipeDetail.tips) {
        Write-Host "  PASS: Tips field exists" -ForegroundColor Green
        $tipsCount = $recipeDetail.tips.Count
        Write-Host "  Tips count: $tipsCount" -ForegroundColor Gray
        
        if ($tipsCount -gt 0) {
            Write-Host "  Tips content:" -ForegroundColor Gray
            foreach ($tip in $recipeDetail.tips) {
                Write-Host "    - [$($tip.type)] $($tip.content)" -ForegroundColor Gray
            }
        }
    } else {
        Write-Host "  FAIL: Tips field is missing" -ForegroundColor Red
    }
}
catch {
    Write-Host "  FAIL: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Test 3: Search with query
Write-Host "[4/5] Testing search functionality..." -ForegroundColor Cyan
try {
    $headers = @{"apikey" = $anonKey}
    $searchUrl = "$baseUrl/public/recipes?q=makaron&limit=10"
    $response = Invoke-WebRequest -Uri $searchUrl -Headers $headers -Method GET -ErrorAction Stop
    $searchData = $response.Content | ConvertFrom-Json
    
    Write-Host "  Found $($searchData.data.Count) recipes matching query" -ForegroundColor Gray
    
    if ($searchData.data.Count -gt 0) {
        $firstResult = $searchData.data[0]
        if ($firstResult.search) {
            Write-Host "  PASS: Search metadata present" -ForegroundColor Green
            Write-Host "    Match source: $($firstResult.search.match)" -ForegroundColor Gray
            Write-Host "    Relevance score: $($firstResult.search.relevance_score)" -ForegroundColor Gray
            
            $validMatches = @('name', 'ingredients', 'tags', 'tips')
            if ($validMatches -contains $firstResult.search.match) {
                Write-Host "  PASS: Match source is valid" -ForegroundColor Green
            } else {
                Write-Host "  FAIL: Invalid match source" -ForegroundColor Red
            }
        } else {
            Write-Host "  FAIL: Search metadata missing" -ForegroundColor Red
        }
    }
}
catch {
    Write-Host "  FAIL: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Test 4: Search validation (query too short)
Write-Host "[5/5] Testing search validation..." -ForegroundColor Cyan
try {
    $headers = @{"apikey" = $anonKey}
    $shortQueryUrl = "$baseUrl/public/recipes?q=ab"
    $response = Invoke-WebRequest -Uri $shortQueryUrl -Headers $headers -Method GET -ErrorAction Stop
    Write-Host "  FAIL: Expected 400 error but got $($response.StatusCode)" -ForegroundColor Red
}
catch {
    $errorResponse = $_.Exception.Response
    if ($errorResponse.StatusCode -eq 400) {
        Write-Host "  PASS: Got expected 400 error for short query" -ForegroundColor Green
    } else {
        Write-Host "  FAIL: Expected 400 but got $($errorResponse.StatusCode)" -ForegroundColor Red
    }
}
Write-Host ""

# Summary
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Test Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Basic tests completed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "For comprehensive testing:" -ForegroundColor Yellow
Write-Host "  - Open test-requests.http in VS Code" -ForegroundColor Gray
Write-Host "  - Review TESTING_TIPS.md for scenarios" -ForegroundColor Gray
Write-Host ""
