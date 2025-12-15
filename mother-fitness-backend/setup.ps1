# MongoDB and Backend Setup Script
# Run this script to set up your environment

Write-Host "🚀 Mother Fitness Backend Setup" -ForegroundColor Cyan
Write-Host "================================`n" -ForegroundColor Cyan

# Step 1: Create .env file
Write-Host "📝 Step 1: Creating .env file..." -ForegroundColor Yellow
if (Test-Path ".env") {
    Write-Host "   ✅ .env file already exists" -ForegroundColor Green
} else {
    Copy-Item ".env.example" ".env"
    Write-Host "   ✅ Created .env file from .env.example" -ForegroundColor Green
}

# Step 2: Start MongoDB
Write-Host "`n🗄️  Step 2: Starting MongoDB service..." -ForegroundColor Yellow
$mongoService = Get-Service -Name MongoDB -ErrorAction SilentlyContinue

if ($null -eq $mongoService) {
    Write-Host "   ⚠️  MongoDB service not found. Trying to start MongoDB manually..." -ForegroundColor Yellow
    Write-Host "   ℹ️  You may need to run this as Administrator" -ForegroundColor Cyan
    Write-Host "   ℹ️  Or start MongoDB manually with: mongod --dbpath C:\data\db" -ForegroundColor Cyan
} else {
    if ($mongoService.Status -eq 'Running') {
        Write-Host "   ✅ MongoDB is already running" -ForegroundColor Green
    } else {
        try {
            Start-Service MongoDB
            Write-Host "   ✅ MongoDB service started successfully" -ForegroundColor Green
        } catch {
            Write-Host "   ❌ Failed to start MongoDB service" -ForegroundColor Red
            Write-Host "   ℹ️  Please run PowerShell as Administrator and try again" -ForegroundColor Cyan
            Write-Host "   ℹ️  Or run: net start MongoDB" -ForegroundColor Cyan
        }
    }
}

# Step 3: Install dependencies (if needed)
Write-Host "`n📦 Step 3: Checking dependencies..." -ForegroundColor Yellow
if (Test-Path "node_modules") {
    Write-Host "   ✅ Dependencies already installed" -ForegroundColor Green
} else {
    Write-Host "   📥 Installing dependencies..." -ForegroundColor Yellow
    npm install
}

# Step 4: Instructions
Write-Host "`n✨ Setup Complete!" -ForegroundColor Green
Write-Host "================================`n" -ForegroundColor Cyan
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Seed the database: npm run seed" -ForegroundColor White
Write-Host "2. Start the server: npm run dev" -ForegroundColor White
Write-Host "3. Verify health: http://localhost:5000/health`n" -ForegroundColor White
