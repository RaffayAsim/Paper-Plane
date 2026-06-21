$token = "EAAAl4rxhwLpQfiqAyk0UtrP0wZ_m9z2IY9ZfBHAsqQxyfC4RIoXMTxhAt8VI7pC"
$planId = "UWUE3BTPLT2O52O7O2GLZQJH"

$headers = @{
    "Authorization" = "Bearer $token"
    "Square-Version" = "2024-01-18"
    "Content-Type"  = "application/json"
}

# Use 'pricing' field instead of 'recurring_price_money' for API version 2024-01-18+
$body = @{
    idempotency_key = [System.Guid]::NewGuid().ToString()
    object = @{
        type = "SUBSCRIPTION_PLAN_VARIATION"
        id   = "#monthly_variation"
        subscription_plan_variation_data = @{
            name                   = "Monthly"
            subscription_plan_id   = $planId
            phases = @(
                @{
                    cadence = "MONTHLY"
                    pricing = @{
                        type         = "STATIC"
                        price_money  = @{ amount = 49900; currency = "USD" }
                    }
                    ordinal = 0
                }
            )
        }
    }
} | ConvertTo-Json -Depth 12

try {
    $r = Invoke-RestMethod `
        -Uri "https://connect.squareupsandbox.com/v2/catalog/object" `
        -Method POST -Headers $headers -Body $body
    $varId = $r.catalog_object.id
    Write-Host "SUCCESS!"
    Write-Host ""
    Write-Host "======= COPY THESE TO YOUR SERVER .env ======="
    Write-Host "SQUARE_APP_ID=sandbox-sq0idb--ZqHLbUp7VvEo_5853ThGQ"
    Write-Host "SQUARE_ACCESS_TOKEN=EAAAl4rxhwLpQfiqAyk0UtrP0wZ_m9z2IY9ZfBHAsqQxyfC4RIoXMTxhAt8VI7pC"
    Write-Host "SQUARE_LOCATION_ID=LZRSSME17EBW3"
    Write-Host "SQUARE_PLAN_VARIATION_ID=$varId"
    Write-Host "==============================================="
} catch {
    $stream = $_.Exception.Response.GetResponseStream()
    $reader = New-Object System.IO.StreamReader($stream)
    Write-Host "ERROR: $($reader.ReadToEnd())"
}
