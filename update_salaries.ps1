$baseDir = "c:\Users\conta\OneDrive\Documents\MyBuddyMaid\mybuddymaid"
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function Update-Files {
    param (
        [string]$Pattern,
        [string]$PartTime,
        [string]$FullTime,
        [string]$LiveIn,
        [string]$Starting,
        [string]$JsonPartTime
    )

    $files = Get-ChildItem -Path $baseDir -Recurse -Filter "*.html" | Where-Object { $_.Name -match $Pattern }
    $count = 0

    foreach ($file in $files) {
        $content = [System.IO.File]::ReadAllText($file.FullName, $utf8NoBom)
        
        # Table
        $content = $content -replace '(<tr><td><strong>Part-Time \(4-6 hrs\)</strong></td><td>)₹[\d,]+\s*[–-]\s*₹[\d,]+(</td></tr>)', "`$1$PartTime`$2"
        $content = $content -replace '(<tr><td><strong>Full-Time \(8-12 hrs\)</strong></td><td>)₹[\d,]+\s*[–-]\s*₹[\d,]+(</td></tr>)', "`$1$FullTime`$2"
        $content = $content -replace '(<tr><td><strong>Live-In \(24/7\)</strong></td><td>)₹[\d,]+\s*[–-]\s*₹[\d,]+(</td></tr>)', "`$1$LiveIn`$2"

        # JSON-LD
        $content = $content -replace '("text":\s*"Part-time starts from )₹[\d,]+\s*[–-]\s*₹[\d,]+(\. Full-time)', "`$1$JsonPartTime`$2"

        # FAQ
        $content = $content -replace '(start from )₹[\d,]+(/month\. Full-time costs )₹[\d,]+\s*[–-]\s*₹[\d,]+( and live-in costs )₹[\d,]+\s*[–-]\s*₹[\d,]+', "`$1$Starting`$2$FullTime`$3$LiveIn"

        # CTA
        $content = $content -replace '(Starting )₹[\d,]+(/mo\.)', "`$1$Starting`$2"

        # Disclaimer
        if ($content -notmatch 'Actual salaries may vary') {
            $content = $content -replace '(</table>)', "`$1`n<p style=`"font-size:.85rem;color:#888;margin-top:.75rem`"><em>*Actual salaries may vary depending on city, locality, experience level, and specific job requirements. The above figures represent approximate pan-India market averages for 2026.</em></p>"
        }

        [System.IO.File]::WriteAllText($file.FullName, $content, $utf8NoBom)
        $count++
    }
    
    Write-Host "Processed $count files for pattern $Pattern"
}

# MAID
Update-Files '^(best-maid-service-|maid-service-in-)' '₹5,000 – ₹7,000' '₹13,000 – ₹16,000' '₹19,000 – ₹24,000' '₹5,000' '₹5,000 - ₹7,000'

# COOK
Update-Files '^(best-cook-service-|cook-service-in-)' '₹8,000 – ₹12,000' '₹12,000 – ₹17,000' '₹17,000 – ₹22,000' '₹12,000' '₹8,000 - ₹12,000'

# NANNY
Update-Files '^(best-nanny-service-|nanny-service-in-)' '₹10,000 – ₹16,000' '₹16,000 – ₹22,000' '₹22,000 – ₹28,000' '₹16,000' '₹10,000 - ₹16,000'

# ELDERLY
Update-Files '^(best-elderly-care-|elderly-care-service-in-)' '₹12,000 – ₹17,000' '₹17,000 – ₹24,000' '₹24,000 – ₹32,000' '₹17,000' '₹12,000 - ₹17,000'

# FULL-TIME MAID
Update-Files '^(best-full-time-maid-|full-time-maid-service-in-)' '₹13,000 – ₹16,000' '₹16,000 – ₹20,000' '₹19,000 – ₹24,000' '₹19,000' '₹13,000 - ₹16,000'

# POSTNATAL
Update-Files '^(best-postnatal-|postnatal-care-service-in-)' '₹18,000 – ₹25,000' '₹25,000 – ₹35,000' '₹35,000 – ₹50,000' '₹25,000' '₹18,000 - ₹25,000'
