<#
.SYNOPSIS
    Syncs <head> scripts from the single source of truth (head-scripts.html)
    into all existing HTML pages in mybuddymaid/.
    
.DESCRIPTION
    Instead of manually editing thousands of HTML files, this script:
    1. Reads the head-scripts.html partial (the single source of truth)
    2. Replaces the script block in every HTML file between markers
    
    Run this after editing head-scripts.html to propagate changes.
    
.EXAMPLE
    powershell -ExecutionPolicy Bypass -File inject-head-scripts.ps1
    
.NOTES
    IMPORTANT: Stop OneDrive sync before running on OneDrive-synced folders.
    Run: taskkill /f /im OneDrive.exe
#>

$rootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$partialsPath = Join-Path $rootDir "seo-generator\templates\partials\head-scripts.html"
$websiteDir = Join-Path $rootDir "mybuddymaid"

# Read the source of truth
if (-not (Test-Path $partialsPath)) {
    Write-Host "ERROR: head-scripts.html not found at: $partialsPath" -ForegroundColor Red
    exit 1
}

$headScripts = [System.IO.File]::ReadAllText($partialsPath)
# Strip the comment block at the top (everything before the first <!-- tag)
$headScripts = ($headScripts -replace '(?s)^/\*\*.*?\*/', '').Trim()

Write-Host "Head scripts loaded from: $partialsPath"
Write-Host "---"

$htmlFiles = Get-ChildItem $websiteDir -Recurse -Filter "*.html"
$modified = 0
$skipped = 0
$failed = 0

foreach ($file in $htmlFiles) {
    try {
        $content = [System.IO.File]::ReadAllText($file.FullName)
        
        # Check if file has the expected structure with Umami + gtag
        # Replace everything between <meta charset="UTF-8"> and <meta name="viewport"
        $pattern = '(?s)(<meta charset="UTF-8">\s*)\n.*?(<!-- Umami Analytics -->.*?gtag\(''config'',\s*''G-R24QC81J4P''\);\s*</script>)'
        
        if ($content -match '(?s)<meta charset="UTF-8">\s*\n\s*<!-- Umami Analytics -->.*?gtag\(''config'',\s*''G-R24QC81J4P''\);\s*</script>') {
            $newContent = $content -replace '(?s)(<!-- Umami Analytics -->.*?gtag\(''config'',\s*''G-R24QC81J4P''\);\s*</script>)', $headScripts
            
            # Only write if content actually changed
            if ($newContent -ne $content) {
                $retries = 0
                $success = $false
                while (-not $success -and $retries -lt 3) {
                    try {
                        [System.IO.File]::WriteAllText($file.FullName, $newContent)
                        $success = $true
                        $modified++
                    } catch {
                        $retries++
                        if ($retries -lt 3) { Start-Sleep -Milliseconds 500 }
                        else {
                            Write-Host "FAILED: $($file.Name) - $_" -ForegroundColor Red
                            $failed++
                        }
                    }
                }
            } else {
                $skipped++
            }
        } else {
            $skipped++
        }
    } catch {
        Write-Host "ERROR: $($file.Name) - $_" -ForegroundColor Red
        $failed++
    }
}

Write-Host "`n=== DONE ===" -ForegroundColor Green
Write-Host "Modified: $modified | Unchanged: $skipped | Failed: $failed | Total: $($htmlFiles.Count)"
