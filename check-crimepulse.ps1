<#
.SYNOPSIS
    Health and status monitor for CrimePulse development services.
.DESCRIPTION
    Probes ports 8000, 5000, and 3000, queries official health endpoints, tests
    database connectivity, verifies frontend configuration and routing, and
    displays an immediate diagnostic summary.
#>

$ErrorActionPreference = "Continue"

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "             CrimePulse Service Health Check              " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

$RootPath = $PSScriptRoot
$FrontendPath = Join-Path $RootPath "frontend"

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

function Probe-Url {
    param([string]$Url, [int]$TimeoutSec = 3)
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    try {
        $data = Invoke-RestMethod -Uri $Url -Method GET -TimeoutSec $TimeoutSec -ErrorAction Stop
        $sw.Stop()
        return @{ Success = $true; StatusCode = 200; Data = $data; ElapsedMs = $sw.ElapsedMilliseconds }
    } catch {
        $sw.Stop()
        $statusCode = $null
        if ($_.Exception.Response) {
            try { $statusCode = [int]$_.Exception.Response.StatusCode } catch {}
        }
        return @{ Success = $false; StatusCode = $statusCode; Error = $_.Exception.Message; ElapsedMs = $sw.ElapsedMilliseconds }
    }
}

function Probe-WebUrl {
    param([string]$Url, [int]$TimeoutSec = 3)
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    try {
        $data = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec $TimeoutSec -ErrorAction Stop
        $sw.Stop()
        return @{ Success = $true; StatusCode = $data.StatusCode; ElapsedMs = $sw.ElapsedMilliseconds }
    } catch {
        $sw.Stop()
        $statusCode = $null
        if ($_.Exception.Response) {
            try { $statusCode = [int]$_.Exception.Response.StatusCode } catch {}
        }
        return @{ Success = $false; StatusCode = $statusCode; Error = $_.Exception.Message; ElapsedMs = $sw.ElapsedMilliseconds }
    }
}

# -----------------------------------------------------------------------------
# 1. FastAPI ML & Analytics Service (Port 8000)
# -----------------------------------------------------------------------------
Write-Host "1. Python FastAPI ML Service (Port 8000):" -ForegroundColor Yellow
$p8000 = Get-ProcessOnPort -Port 8000
if ($p8000) {
    Write-Host "   Process:   PID $($p8000.ProcessId) ($($p8000.Name))" -ForegroundColor DarkGray
    $fastApiHealth = Probe-Url -Url "http://127.0.0.1:8000/health"
    if ($fastApiHealth.Success) {
        Write-Host "   [OK] Health:    ONLINE ($($fastApiHealth.ElapsedMs)ms)" -ForegroundColor Green
        Write-Host "   [OK] Model:     Loaded ($($fastApiHealth.Data.model_loaded))" -ForegroundColor Green

        $fastApiMeta = Probe-Url -Url "http://127.0.0.1:8000/analytics/metadata"
        if ($fastApiMeta.Success) {
            Write-Host "   [OK] Analytics: READY ($($fastApiMeta.Data.total_records) records, $($fastApiMeta.Data.states.Count) states)" -ForegroundColor Green
        } else {
            Write-Host "   [WARN] Analytics: UNAVAILABLE or endpoint error" -ForegroundColor Yellow
        }

        $fastApiDocs = Probe-WebUrl -Url "http://127.0.0.1:8000/docs"
        if ($fastApiDocs.Success) {
            Write-Host "   [OK] Docs:      Swagger UI available at http://127.0.0.1:8000/docs" -ForegroundColor Green
        }
    } else {
        Write-Host "   [FAIL] Health:  UNRESPONSIVE ($($fastApiHealth.Error))" -ForegroundColor Red
    }
} else {
    Write-Host "   [FAIL] Status:  OFFLINE (No process listening on port 8000)" -ForegroundColor Red
    Write-Host "   Action:         Run .\start-crimepulse.ps1 to start services" -ForegroundColor DarkGray
}

Write-Host ""

# -----------------------------------------------------------------------------
# 2. Express Backend API Gateway (Port 5000)
# -----------------------------------------------------------------------------
Write-Host "2. Express Backend API Gateway (Port 5000):" -ForegroundColor Yellow
$p5000 = Get-ProcessOnPort -Port 5000
if ($p5000) {
    Write-Host "   Process:   PID $($p5000.ProcessId) ($($p5000.Name))" -ForegroundColor DarkGray
    $expressHealth = Probe-Url -Url "http://127.0.0.1:5000/api/health"
    if ($expressHealth.Success) {
        Write-Host "   [OK] Health:    ONLINE ($($expressHealth.ElapsedMs)ms)" -ForegroundColor Green

        $dbHealth = Probe-Url -Url "http://127.0.0.1:5000/api/health/db"
        if ($dbHealth.Success -and $dbHealth.Data.database -eq "connected") {
            Write-Host "   [OK] Database:  MongoDB Atlas CONNECTED" -ForegroundColor Green
        } else {
            Write-Host "   [WARN] Database: DISCONNECTED / NOT READY" -ForegroundColor Yellow
        }

        # Check analytics gateway route registration (HTTP 401 unauthenticated confirms route is mounted with auth guard)
        $analyticsGateway = Probe-Url -Url "http://127.0.0.1:5000/api/analytics/metadata"
        if ($analyticsGateway.Success -or $analyticsGateway.StatusCode -eq 401 -or $analyticsGateway.StatusCode -eq 403) {
            Write-Host "   [OK] Analytics: Gateway routes mounted and secured (HTTP $($analyticsGateway.StatusCode))" -ForegroundColor Green
        } else {
            Write-Host "   [WARN] Analytics: Gateway routes unverified (HTTP $($analyticsGateway.StatusCode))" -ForegroundColor Yellow
        }
    } else {
        Write-Host "   [FAIL] Health:  UNRESPONSIVE ($($expressHealth.Error))" -ForegroundColor Red
    }
} else {
    Write-Host "   [FAIL] Status:  OFFLINE (No process listening on port 5000)" -ForegroundColor Red
    Write-Host "   Action:         Run .\start-crimepulse.ps1 to start services" -ForegroundColor DarkGray
}

Write-Host ""

# -----------------------------------------------------------------------------
# 3. React + Vite Frontend (Port 3000)
# -----------------------------------------------------------------------------
Write-Host "3. React + Vite Frontend (Port 3000):" -ForegroundColor Yellow
$p3000 = Get-ProcessOnPort -Port 3000
if ($p3000) {
    Write-Host "   Process:   PID $($p3000.ProcessId) ($($p3000.Name))" -ForegroundColor DarkGray
    $feWeb = Probe-WebUrl -Url "http://localhost:3000"
    if ($feWeb.Success -and ($feWeb.StatusCode -eq 200 -or $feWeb.StatusCode -eq 304)) {
        Write-Host "   [OK] Health:    ONLINE ($($feWeb.ElapsedMs)ms) - HTTP $($feWeb.StatusCode)" -ForegroundColor Green

        # Check frontend env config
        $feEnv = Join-Path $FrontendPath ".env"
        if (Test-Path $feEnv) {
            $content = Get-Content $feEnv -Raw
            if ($content -match "VITE_API_BASE_URL=(.*)") {
                Write-Host "   [OK] Config:    API Target -> $($Matches[1].Trim())" -ForegroundColor Green
            }
        }
        Write-Host "   [OK] URL:       http://localhost:3000" -ForegroundColor Green
    } else {
        Write-Host "   [FAIL] Health:  UNRESPONSIVE ($($feWeb.Error))" -ForegroundColor Red
    }
} else {
    Write-Host "   [FAIL] Status:  OFFLINE (No process listening on port 3000)" -ForegroundColor Red
    Write-Host "   Action:         Run .\start-crimepulse.ps1 to start services" -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Quick Actions:" -ForegroundColor DarkGray
Write-Host "  - Start all servers & open browser: npm start (or .\start-crimepulse.ps1)" -ForegroundColor DarkGray
Write-Host "  - Stop all servers:                 npm stop (or .\stop-crimepulse.ps1)" -ForegroundColor DarkGray
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""
