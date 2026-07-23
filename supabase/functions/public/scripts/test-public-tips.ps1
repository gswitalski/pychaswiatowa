# Test script for Public Recipes API - Tips search functionality
# This script helps test the new tips field integration

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "Public Recipes API - Tips Search Test Script" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

# Configuration
$baseUrl = "http://localhost:54321/functions/v1"
$anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"

# Function to make HTTP request and display result
function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Url,
        [string]$ExpectedStatus = "200"
    )
    
    Write-Host "[TEST] $Name" -ForegroundColor Yellow
    Write-Host "  URL: $Url" -ForegroundColor Gray
    
    try {
        $headers = @{
            "apikey" = $anonKey
        }
        
        $response = Invoke-WebRequest -Uri $Url -Headers $headers -Method GET -ErrorAction Stop
        $statusCode = $response.StatusCode
        $content = $response.Content | ConvertFrom-Json
        
        if ($statusCode -eq $ExpectedStatus) {
            Write-Host "  ✓ PASSED (Status: $statusCode)" -ForegroundColor Green
            return $content
        } else {
            Write-Host "  ✗ FAILED (Expected: $ExpectedStatus, Got: $statusCode)" -ForegroundColor Red
            return $null
        }
    }
    catch {
        Write-Host "  ✗ ERROR: $($_.Exception.Message)" -ForegroundColor Red
        return $null
    }
    finally {
        Write-Host ""
    }
}

# Check if Supabase is running
Write-Host "[1/6] Checking if Supabase is running..." -ForegroundColor Cyan
try {
    $healthCheck = Invoke-WebRequest -Uri "http://localhost:54321/rest/v1/" -Headers @{"apikey" = $anonKey} -Method GET -TimeoutSec 5 -ErrorAction Stop
    Write-Host "  ✓ Supabase is running" -ForegroundColor Green
    Write-Host ""
}
catch {
    Write-Host "  ✗ Supabase is NOT running. Please start it with: supabase start" -ForegroundColor Red
    Write-Host ""
    exit 1
}

# Test 1: Get list of recipes to find test IDs
Write-Host "[2/6] Getting public recipes list..." -ForegroundColor Cyan
$listUrl = "$baseUrl/public/recipes?limit=5"
$recipesList = Test-Endpoint -Name "GET /public/recipes (list)" -Url $listUrl

if ($recipesList -and $recipesList.data.Count -gt 0) {
    $testRecipeId = $recipesList.data[0].id
    Write-Host "  Found test recipe ID: $testRecipeId" -ForegroundColor Gray
    Write-Host ""
} else {
    Write-Host "  ✗ No public recipes found. Please create at least one public recipe." -ForegroundColor Red
    Write-Host ""
    exit 1
}

# Test 2: Get recipe detail (check if tips field exists)
Write-Host "[3/6] Testing recipe detail (tips field)..." -ForegroundColor Cyan
$detailUrl = "$baseUrl/public/recipes/$testRecipeId"
$recipeDetail = Test-Endpoint -Name "GET /public/recipes/{id}" -Url $detailUrl

if ($recipeDetail) {
    if ($null -ne $recipeDetail.tips) {
        Write-Host "  ✓ Tips field is present" -ForegroundColor Green
        $tipsCount = $recipeDetail.tips.Count
        Write-Host "  Tips count: $tipsCount" -ForegroundColor Gray
        
        if ($tipsCount -gt 0) {
            Write-Host "  Tips content:" -ForegroundColor Gray
            foreach ($tip in $recipeDetail.tips) {
                Write-Host "    - [$($tip.type)] $($tip.content)" -ForegroundColor Gray
            }
        } else {
            Write-Host "  Tips array is empty (which is OK)" -ForegroundColor Gray
        }
    } else {
        Write-Host "  ✗ Tips field is MISSING" -ForegroundColor Red
    }
    Write-Host ""
}

# Test 3: Search without query (baseline)
Write-Host "[4/6] Testing search without query..." -ForegroundColor Cyan
$noSearchUrl = "$baseUrl/public/recipes?limit=5"
$noSearchResult = Test-Endpoint -Name "GET /public/recipes (no search)" -Url $noSearchUrl

if ($noSearchResult -and $noSearchResult.data.Count -gt 0) {
    $firstRecipe = $noSearchResult.data[0]
    if ($null -eq $firstRecipe.search) {
        Write-Host "  ✓ No search metadata when q is not provided (correct)" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Search metadata present when q is not provided (incorrect)" -ForegroundColor Red
    }
    Write-Host ""
}

# Test 4: Search with valid query
Write-Host "[5/6] Testing search with query..." -ForegroundColor Cyan
$searchUrl = "$baseUrl/public/recipes?q=makaron&limit=10"
$searchResult = Test-Endpoint -Name "GET /public/recipes?q=makaron" -Url $searchUrl

if ($searchResult -and $searchResult.data.Count -gt 0) {
    Write-Host "  Found $($searchResult.data.Count) recipes matching makaron" -ForegroundColor Gray
    
    # Check first result for search metadata
    $firstResult = $searchResult.data[0]
    if ($firstResult.search) {
        Write-Host "  Success: Search metadata is present" -ForegroundColor Green
        Write-Host "    - Match: $($firstResult.search.match)" -ForegroundColor Gray
        Write-Host "    - Relevance: $($firstResult.search.relevance_score)" -ForegroundColor Gray
        
        # Validate match source
        $validMatches = @('name', 'ingredients', 'tags', 'tips')
        if ($validMatches -contains $firstResult.search.match) {
            Write-Host "  Success: Match source is valid" -ForegroundColor Green
        } else {
            Write-Host "  Error: Invalid match source: $($firstResult.search.match)" -ForegroundColor Red
        }
    } else {
        Write-Host "  Error: Search metadata is MISSING" -ForegroundColor Red
    }
}
elseif ($searchResult -and $searchResult.data.Count -eq 0) {
    Write-Host "  No recipes found matching makaron (might be expected)" -ForegroundColor Yellow
}
else {
    Write-Host "  Error: Search request failed" -ForegroundColor Red
}
Write-Host ""

# Test 5: Search with query too short (should fail with 400)
Write-Host "[6/6] Testing search validation (query too short)..." -ForegroundColor Cyan
$shortQueryUrl = "$baseUrl/public/recipes?q=ab"

try {
    $headers = @{
        "apikey" = $anonKey
    }
    
    $response = Invoke-WebRequest -Uri $shortQueryUrl -Headers $headers -Method GET -ErrorAction Stop
    Write-Host "  ✗ FAILED: Expected 400 error, but got $($response.StatusCode)" -ForegroundColor Red
}
catch {
    $errorResponse = $_.Exception.Response
    if ($errorResponse.StatusCode -eq 400) {
        Write-Host "  ✓ PASSED: Got expected 400 error for query too short" -ForegroundColor Green
    } else {
        Write-Host "  ✗ FAILED: Expected 400, but got $($errorResponse.StatusCode)" -ForegroundColor Red
    }
}
Write-Host ""

# Summary
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "Test Summary" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Basic tests completed. For more comprehensive testing:" -ForegroundColor Yellow
Write-Host "  1. Open supabase/functions/public/test-requests.http in VS Code" -ForegroundColor Gray
Write-Host "  2. Use REST Client extension to run individual tests" -ForegroundColor Gray
Write-Host "  3. Review TESTING_TIPS.md for detailed test scenarios" -ForegroundColor Gray
Write-Host ""
Write-Host "To test tips-specific search:" -ForegroundColor Yellow
Write-Host "  1. Create a recipe with tips content" -ForegroundColor Gray
Write-Host "  2. Search for a word that exists ONLY in tips" -ForegroundColor Gray
Write-Host "  3. Verify search.match=tips and relevance_score=0.5" -ForegroundColor Gray
Write-Host ""
