$apiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
$cursor = "eyJ2IjoxLCJvZmZzZXQiOjUsImxpbWl0Ijo1LCJzb3J0IjoiY3JlYXRlZF9hdC5kZXNjIiwiZmlsdGVyc0hhc2giOiJlOGM2ZDc0YTQ2MWYxNDJjOGVmOTA2NDJkOWIzODJlOTM3OGRkZDBkYTkwZjE3ZDkxM2VjYmJhMjQyMjUyYTRmIn0"
$uri = "http://127.0.0.1:54331/functions/v1/public/recipes/feed?limit=5&cursor=$cursor"

Write-Host "Testing: GET with cursor (page 2)" -ForegroundColor Yellow

try {
    $response = Invoke-WebRequest -Uri $uri -Headers @{"apikey"=$apiKey} -UseBasicParsing
    Write-Host "Status: $($response.StatusCode)" -ForegroundColor Green
    
    $json = $response.Content | ConvertFrom-Json
    Write-Host "Recipes count: $($json.data.Count)" -ForegroundColor Cyan
    Write-Host "First recipe ID: $($json.data[0].id)" -ForegroundColor Cyan
    Write-Host "hasMore: $($json.pageInfo.hasMore)" -ForegroundColor Cyan
    Write-Host "`nFirst 2 recipes:" -ForegroundColor Cyan
    $json.data[0..1] | ForEach-Object { Write-Host "  - [$($_.id)] $($_.name)" }
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

