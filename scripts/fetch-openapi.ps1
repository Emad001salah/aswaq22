$urls = @(
    'http://localhost:3000/api/swagger.json',
    'http://localhost:3000/api/openapi.json',
    'http://localhost:5000/api/swagger.json',
    'http://localhost:5000/api/openapi.json'
)
$out = 'aswaq-mobile/api-contract.yaml'
foreach ($u in $urls) {
    try {
        Invoke-WebRequest -Uri $u -OutFile $out -ErrorAction Stop
        Write-Host "Fetched $u"
        break
    } catch {
        Write-Host "Failed $u"
    }
}
