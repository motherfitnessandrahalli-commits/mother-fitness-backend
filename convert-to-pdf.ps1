# PowerShell script to convert HTML to PDF using Chrome in headless mode
$htmlPath = "file:///c:/Users/Vinay/Downloads/ultra-fitness-gym 6.1 comp backend/Ultra-Fitness-Walkthrough.html"
$pdfPath = "c:\Users\Vinay\Downloads\Ultra-Fitness-Codebase-Walkthrough.pdf"

# Find Chrome executable
$chromePaths = @(
    "C:\Program Files\Google\Chrome\Application\chrome.exe",
    "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
)

$chromePath = $null
foreach ($path in $chromePaths) {
    if (Test-Path $path) {
        $chromePath = $path
        break
    }
}

if ($chromePath) {
    Write-Host "✅ Found Chrome at: $chromePath" -ForegroundColor Green
    Write-Host "🔄 Converting HTML to PDF..." -ForegroundColor Yellow
    
    # Run Chrome in headless mode to generate PDF
    & $chromePath --headless --disable-gpu --print-to-pdf="$pdfPath" "$htmlPath"
    
    # Wait a moment for the file to be created
    Start-Sleep -Seconds 2
    
    if (Test-Path $pdfPath) {
        Write-Host "✅ PDF created successfully!" -ForegroundColor Green
        Write-Host "📄 Location: $pdfPath" -ForegroundColor Cyan
        
        # Open the PDF
        Start-Process $pdfPath
    } else {
        Write-Host "❌ PDF creation failed" -ForegroundColor Red
    }
} else {
    Write-Host "❌ Chrome not found. Please install Google Chrome." -ForegroundColor Red
    Write-Host "💡 Alternative: Open the HTML file and press Ctrl+P to save as PDF manually" -ForegroundColor Yellow
}
