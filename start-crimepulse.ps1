<#
.SYNOPSIS
    Starts and verifies all CrimePulse development services and opens the application.
.DESCRIPTION
    Safely checks ports 8000, 5000, and 3000, prevents duplicate processes, reuses
    already-running healthy services, launches missing services in separate visible
    terminal windows with live logging, polls real HTTP health endpoints to confirm
    system readiness (including MongoDB Atlas and ML model), and opens the website in
    the default browser.
#>

param(
    [switch]$SkipBrowser = $false
)

$ErrorActionPreference = "Continue"

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "         CrimePulse Development Server Manager            " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

$RootPath = $PSScriptRoot
$BackendPath = Join-Path $RootPath "backend"
$MlPath = Join-Path $RootPath "ml-service"
$FrontendPath = Join-Path $RootPath "frontend"

# -----------------------------------------------------------------------------
# Helper: Get process details listening on a port
# -----------------------------------------------------------------------------
function Get-ProcessOnPort {
    param([int]$Port)
    try {
        $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($conn) {
            $proc = Get-CimInstance Win32_Process -Filter "ProcessId = $($conn.OwningProcess)" -ErrorAction SilentlyContinue
            return [PSCustomObject]@{
                Port        = $Port
                ProcessId   = $conn.OwningProcess
                Name        = $proc.Name
                CommandLine = $proc.CommandLine
            }
        }
    } catch {}
    return $null
}

# -----------------------------------------------------------------------------
# Helper: Probe HTTP endpoint returning JSON
# -----------------------------------------------------------------------------
function Test-HttpEndpoint {
    param([string]$Url, [int]$TimeoutSec = 3)
    try {
        $response = Invoke-RestMethod -Uri $Url -Method GET -TimeoutSec $TimeoutSec -ErrorAction Stop
        return @{ Success = $true; StatusCode = 200; Data = $response }
    } catch {
        $statusCode = $null
        if ($_.Exception.Response) {
            try { $statusCode = [int]$_.Exception.Response.StatusCode } catch {}
        }
        return @{ Success = $false; StatusCode = $statusCode; Error = $_.Exception.Message }
    }
}

# -----------------------------------------------------------------------------
# Helper: Probe Web page (HTML / Vite)
# -----------------------------------------------------------------------------
function Test-WebUrl {
    param([string]$Url, [int]$TimeoutSec = 3)
    try {
        $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec $TimeoutSec -ErrorAction Stop
        return @{ Success = $true; StatusCode = $response.StatusCode }
    } catch {
        $statusCode = $null
        if ($_.Exception.Response) {
            try { $statusCode = [int]$_.Exception.Response.StatusCode } catch {}
        }
        return @{ Success = $false; StatusCode = $statusCode; Error = $_.Exception.Message }
    }
}

# -----------------------------------------------------------------------------
# 1. Prerequisite Checks
# -----------------------------------------------------------------------------
Write-Host "[1/5] Verifying prerequisites and configuration..." -ForegroundColor Yellow

$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
    Write-Host "  [FAIL] Node.js was not found in PATH. Please install Node.js (v18+)." -ForegroundColor Red
    exit 1
}

$pythonCmd = Get-Command python -ErrorAction SilentlyContinue
if (-not $pythonCmd) {
    Write-Host "  [FAIL] Python was not found in PATH. Please install Python (3.10+)." -ForegroundColor Red
    exit 1
}

# Backend environment check
$backendEnv = Join-Path $BackendPath ".env"
if (-not (Test-Path $backendEnv)) {
    Write-Host "  [WARN] backend/.env was not found. Copying backend/.env.example to .env..." -ForegroundColor Yellow
    $exampleEnv = Join-Path $BackendPath ".env.example"
    if (Test-Path $exampleEnv) {
        Copy-Item $exampleEnv $backendEnv
    }
}

# Frontend environment check
$frontendEnv = Join-Path $FrontendPath ".env"
if (-not (Test-Path $frontendEnv)) {
    Write-Host "  [WARN] frontend/.env was not found. Creating default frontend/.env..." -ForegroundColor Yellow
    "VITE_API_BASE_URL=http://localhost:5000/api" | Set-Content -Path $frontendEnv -Encoding utf8
}

Write-Host "  [OK] Node.js, Python, and environment files verified." -ForegroundColor Green

# -----------------------------------------------------------------------------
# 2. Check & Start Python FastAPI Service (Port 8000)
# -----------------------------------------------------------------------------
Write-Host "`n[2/5] Checking Python FastAPI ML & Analytics Service (Port 8000)..." -ForegroundColor Yellow

$mlProc = Get-ProcessOnPort -Port 8000
$startMl = $false

if ($mlProc) {
    $mlHealth = Test-HttpEndpoint -Url "http://127.0.0.1:8000/health"
    if ($mlHealth.Success -and $mlHealth.Data.status -eq "ok") {
        Write-Host "  [OK] FastAPI service is ALREADY running and healthy (PID: $($mlProc.ProcessId))." -ForegroundColor Green
    } else {
        $isCrimePulseMl = ($mlProc.CommandLine -match "uvicorn" -or
                           $mlProc.CommandLine -match "api\.main:app" -or
                           $mlProc.CommandLine -match "ml-service")
        if ($isCrimePulseMl) {
            Write-Host "  [WARN] Stale CrimePulse FastAPI process detected on port 8000 (PID $($mlProc.ProcessId)). Restarting..." -ForegroundColor Yellow
            try {
                Stop-Process -Id $mlProc.ProcessId -Force -ErrorAction Stop
                Start-Sleep -Milliseconds 800
                $startMl = $true
            } catch {
                Write-Host "  [FAIL] Could not stop stale process: $($_.Exception.Message)" -ForegroundColor Red
            }
        } else {
            Write-Host "  [FAIL] Port 8000 is occupied by an UNRELATED application (PID $($mlProc.ProcessId): $($mlProc.Name))." -ForegroundColor Red
            Write-Host "         Command: $($mlProc.CommandLine)" -ForegroundColor DarkGray
            Write-Host "         Skipping startup to avoid terminating unrelated software." -ForegroundColor Red
        }
    }
} else {
    $startMl = $true
}

if ($startMl) {
    Write-Host "  [INFO] Launching FastAPI ML service on port 8000 in a new window..." -ForegroundColor Cyan
    $mlCmd = "& { Set-Location '$MlPath'; `$Host.UI.RawUI.WindowTitle = 'CrimePulse - Python FastAPI Service (Port 8000)'; Write-Host '===========================================================' -ForegroundColor Yellow; Write-Host '   CrimePulse Python FastAPI ML & Analytics Service        ' -ForegroundColor Yellow; Write-Host '   Port: 8000 | URL: http://localhost:8000                 ' -ForegroundColor Yellow; Write-Host '   Press Ctrl+C to stop this service                       ' -ForegroundColor Yellow; Write-Host '===========================================================' -ForegroundColor Yellow; python -m uvicorn api.main:app --reload --port 8000 }"
    Start-Process powershell.exe -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $mlCmd
}

# -----------------------------------------------------------------------------
# 3. Check & Start Express Backend Service (Port 5000)
# -----------------------------------------------------------------------------
Write-Host "`n[3/5] Checking Express API Gateway (Port 5000)..." -ForegroundColor Yellow

$backendProc = Get-ProcessOnPort -Port 5000
$startBackend = $false

if ($backendProc) {
    $backendHealth = Test-HttpEndpoint -Url "http://127.0.0.1:5000/api/health"
    if ($backendHealth.Success -and $backendHealth.Data.status -eq "ok") {
        Write-Host "  [OK] Express backend is ALREADY running and healthy (PID: $($backendProc.ProcessId))." -ForegroundColor Green
    } else {
        $isCrimePulseBackend = ($backendProc.CommandLine -match "server\.js" -or
                                $backendProc.CommandLine -match "nodemon" -or
                                $backendProc.CommandLine -match "backend")
        if ($isCrimePulseBackend) {
            Write-Host "  [WARN] Stale CrimePulse Express process detected on port 5000 (PID $($backendProc.ProcessId)). Restarting..." -ForegroundColor Yellow
            try {
                Stop-Process -Id $backendProc.ProcessId -Force -ErrorAction Stop
                Start-Sleep -Milliseconds 800
                $startBackend = $true
            } catch {
                Write-Host "  [FAIL] Could not stop stale process: $($_.Exception.Message)" -ForegroundColor Red
            }
        } else {
            Write-Host "  [FAIL] Port 5000 is occupied by an UNRELATED application (PID $($backendProc.ProcessId): $($backendProc.Name))." -ForegroundColor Red
            Write-Host "         Command: $($backendProc.CommandLine)" -ForegroundColor DarkGray
            Write-Host "         Skipping startup to avoid terminating unrelated software." -ForegroundColor Red
        }
    }
} else {
    $startBackend = $true
}

if ($startBackend) {
    Write-Host "  [INFO] Launching Express backend on port 5000 in a new window..." -ForegroundColor Cyan
    $backendCmd = "& { Set-Location '$BackendPath'; `$Host.UI.RawUI.WindowTitle = 'CrimePulse - Express Backend API Gateway (Port 5000)'; Write-Host '===========================================================' -ForegroundColor Cyan; Write-Host '   CrimePulse Express Backend API Gateway                  ' -ForegroundColor Cyan; Write-Host '   Port: 5000 | URL: http://localhost:5000                 ' -ForegroundColor Cyan; Write-Host '   Press Ctrl+C to stop this service                       ' -ForegroundColor Cyan; Write-Host '===========================================================' -ForegroundColor Cyan; npm run dev }"
    Start-Process powershell.exe -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $backendCmd
}

# -----------------------------------------------------------------------------
# 4. Check & Start React + Vite Frontend (Port 3000)
# -----------------------------------------------------------------------------
Write-Host "`n[4/5] Checking React + Vite Frontend (Port 3000)..." -ForegroundColor Yellow

$frontendProc = Get-ProcessOnPort -Port 3000
$startFrontend = $false

if ($frontendProc) {
    $frontendHealth = Test-WebUrl -Url "http://localhost:3000"
    if ($frontendHealth.Success -and ($frontendHealth.StatusCode -eq 200 -or $frontendHealth.StatusCode -eq 304)) {
        Write-Host "  [OK] React + Vite frontend is ALREADY running and healthy (PID: $($frontendProc.ProcessId))." -ForegroundColor Green
    } else {
        $isCrimePulseFrontend = ($frontendProc.CommandLine -match "vite" -or
                                 $frontendProc.CommandLine -match "frontend")
        if ($isCrimePulseFrontend) {
            Write-Host "  [WARN] Stale CrimePulse Frontend process detected on port 3000 (PID $($frontendProc.ProcessId)). Restarting..." -ForegroundColor Yellow
            try {
                Stop-Process -Id $frontendProc.ProcessId -Force -ErrorAction Stop
                Start-Sleep -Milliseconds 800
                $startFrontend = $true
            } catch {
                Write-Host "  [FAIL] Could not stop stale process: $($_.Exception.Message)" -ForegroundColor Red
            }
        } else {
            Write-Host "  [FAIL] Port 3000 is occupied by an UNRELATED application (PID $($frontendProc.ProcessId): $($frontendProc.Name))." -ForegroundColor Red
            Write-Host "         Command: $($frontendProc.CommandLine)" -ForegroundColor DarkGray
            Write-Host "         Skipping frontend launch to avoid port conflict." -ForegroundColor Red
        }
    }
} else {
    $startFrontend = $true
}

if ($startFrontend) {
    Write-Host "  [INFO] Launching React + Vite frontend on port 3000 in a new window..." -ForegroundColor Cyan
    $frontendCmd = "& { Set-Location '$FrontendPath'; `$Host.UI.RawUI.WindowTitle = 'CrimePulse - React Vite Frontend (Port 3000)'; Write-Host '===========================================================' -ForegroundColor Green; Write-Host '   CrimePulse React + Vite Frontend Application            ' -ForegroundColor Green; Write-Host '   Port: 3000 | URL: http://localhost:3000                 ' -ForegroundColor Green; Write-Host '   Press Ctrl+C to stop this service                       ' -ForegroundColor Green; Write-Host '===========================================================' -ForegroundColor Green; npm run dev }"
    Start-Process powershell.exe -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $frontendCmd
}

# -----------------------------------------------------------------------------
# 5. Health Polling and Full Application Verification
# -----------------------------------------------------------------------------
Write-Host "`n[5/5] Verifying live service health and readiness..." -ForegroundColor Yellow

$maxAttempts = 20
$attempt = 1
$fastApiReady = $false
$expressReady = $false
$dbReady = $false
$frontendReady = $false

while ($attempt -le $maxAttempts) {
    Write-Host -NoNewline "  Checking endpoints (attempt $attempt/$maxAttempts)... "

    if (-not $fastApiReady) {
        $fCheck = Test-HttpEndpoint -Url "http://127.0.0.1:8000/health"
        if ($fCheck.Success -and $fCheck.Data.status -eq "ok" -and $fCheck.Data.model_loaded -eq $true) {
            $fastApiReady = $true
        }
    }

    if (-not $expressReady) {
        $eCheck = Test-HttpEndpoint -Url "http://127.0.0.1:5000/api/health"
        if ($eCheck.Success -and $eCheck.Data.status -eq "ok") {
            $expressReady = $true
        }
    }

    if ($expressReady -and (-not $dbReady)) {
        $dbCheck = Test-HttpEndpoint -Url "http://127.0.0.1:5000/api/health/db"
        if ($dbCheck.Success -and $dbCheck.Data.database -eq "connected") {
            $dbReady = $true
        }
    }

    if (-not $frontendReady) {
        $feCheck = Test-WebUrl -Url "http://localhost:3000"
        if ($feCheck.Success -and ($feCheck.StatusCode -eq 200 -or $feCheck.StatusCode -eq 304)) {
            $frontendReady = $true
        }
    }

    if ($fastApiReady -and $expressReady -and $frontendReady) {
        Write-Host "Ready!" -ForegroundColor Green
        break
    }

    Write-Host "waiting..." -ForegroundColor DarkGray
    Start-Sleep -Seconds 1
    $attempt++
}

# Verify secondary documentation and gateway endpoints
$fastApiDocs = Test-WebUrl -Url "http://127.0.0.1:8000/docs"
$analyticsGateway = Test-HttpEndpoint -Url "http://127.0.0.1:5000/api/analytics/metadata"
# An HTTP 401 response confirms the gateway route is registered and protected by JWT auth
$gatewayRegistered = ($analyticsGateway.Success -or $analyticsGateway.StatusCode -eq 401 -or $analyticsGateway.StatusCode -eq 403)

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "                     Status Summary                       " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# FastAPI report
if ($fastApiReady) {
    Write-Host "  [OK] Python FastAPI ML Service: ONLINE" -ForegroundColor Green
    Write-Host "       Health URL:    http://127.0.0.1:8000/health" -ForegroundColor DarkGray
    Write-Host "       Swagger Docs:  http://127.0.0.1:8000/docs (Status: $($fastApiDocs.StatusCode))" -ForegroundColor DarkGray
    Write-Host "       Model Ready:   YES (Random Forest classifier loaded)" -ForegroundColor DarkGray
} else {
    Write-Host "  [FAIL] Python FastAPI ML Service: OFFLINE or initializing" -ForegroundColor Red
    Write-Host "         Check the opened FastAPI PowerShell window for startup logs." -ForegroundColor DarkGray
}

# Express report
if ($expressReady) {
    Write-Host "`n  [OK] Express API Gateway:       ONLINE" -ForegroundColor Green
    Write-Host "       Health URL:    http://127.0.0.1:5000/api/health" -ForegroundColor DarkGray
    if ($gatewayRegistered) {
        Write-Host "       Analytics API: http://127.0.0.1:5000/api/analytics/metadata (Route Registered, JWT Guard Active)" -ForegroundColor DarkGray
    }
} else {
    Write-Host "`n  [FAIL] Express API Gateway:       OFFLINE or initializing" -ForegroundColor Red
    Write-Host "         Check the opened Express PowerShell window for startup logs." -ForegroundColor DarkGray
}

# DB report
if ($dbReady) {
    Write-Host "  [OK] MongoDB Atlas Connection:  CONNECTED" -ForegroundColor Green
} elseif ($expressReady) {
    Write-Host "  [WARN] MongoDB Atlas Connection:  CONNECTING / SLOW" -ForegroundColor Yellow
}

# Frontend report
if ($frontendReady) {
    Write-Host "`n  [OK] React + Vite Frontend:     ONLINE" -ForegroundColor Green
    Write-Host "       App URL:       http://localhost:3000" -ForegroundColor DarkGray
} else {
    Write-Host "`n  [FAIL] React + Vite Frontend:     OFFLINE or initializing" -ForegroundColor Red
    Write-Host "         Check the opened Frontend PowerShell window for startup logs." -ForegroundColor DarkGray
}

# -----------------------------------------------------------------------------
# 6. Automatic Browser Launch
# -----------------------------------------------------------------------------
if ($frontendReady -and (-not $SkipBrowser)) {
    Write-Host ""
    Write-Host "----------------------------------------------------------" -ForegroundColor DarkGray
    Write-Host "Opening CrimePulse in your default browser..." -ForegroundColor Yellow
    try {
        Start-Process "http://localhost:3000"
        Write-Host "  [OK] Browser opened successfully to: http://localhost:3000" -ForegroundColor Green
    } catch {
        Write-Host "  [WARN] Could not automatically launch browser: $($_.Exception.Message)" -ForegroundColor Yellow
        Write-Host "         Please manually open http://localhost:3000 in your browser." -ForegroundColor DarkGray
    }
}

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Management Tips:" -ForegroundColor DarkGray
Write-Host "  - To check status: Run .\check-crimepulse.ps1 (or npm run status)" -ForegroundColor DarkGray
Write-Host "  - To stop servers: Run .\stop-crimepulse.ps1 (or npm stop)" -ForegroundColor DarkGray
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""
