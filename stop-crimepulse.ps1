<#
.SYNOPSIS
    Safely stops CrimePulse development servers (Frontend, Express & FastAPI).
.DESCRIPTION
    Inspects ports 3000, 5000, and 8000, confirms that the occupying processes belong
    specifically to CrimePulse, and terminates only those confirmed processes.
    Never kills unrelated node.exe or python.exe processes.
#>

param(
    [switch]$Force = $false
)

$ErrorActionPreference = "Continue"

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "         CrimePulse Development Server Shutdown           " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

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
# 1. Inspect Port 3000 (React Vite Frontend)
# -----------------------------------------------------------------------------
Write-Host "[1/3] Checking port 3000 (React Vite Frontend)..." -ForegroundColor Yellow
$proc3000 = Get-ProcessOnPort -Port 3000

if (-not $proc3000) {
    Write-Host "  ✅ Port 3000 is already free." -ForegroundColor Green
} else {
    Write-Host "  Found process on port 3000: PID $($proc3000.ProcessId) ($($proc3000.Name))" -ForegroundColor Cyan
    Write-Host "  Command: $($proc3000.CommandLine)" -ForegroundColor DarkGray

    # Safety check: confirm process is CrimePulse Vite / frontend
    $isCrimePulseFrontend = ($proc3000.CommandLine -match "vite" -or
                             $proc3000.CommandLine -match "frontend")

    if ($isCrimePulseFrontend) {
        Write-Host "  Stopping CrimePulse Frontend process (PID: $($proc3000.ProcessId))..." -ForegroundColor Yellow
        try {
            Stop-Process -Id $proc3000.ProcessId -Force -ErrorAction Stop
            Start-Sleep -Milliseconds 500
            Write-Host "  ✅ Successfully stopped Vite frontend (PID: $($proc3000.ProcessId))." -ForegroundColor Green
        } catch {
            Write-Host "  ❌ Failed to stop PID $($proc3000.ProcessId): $($_.Exception.Message)" -ForegroundColor Red
        }
    } else {
        Write-Host "  ⚠️ Process on port 3000 does NOT appear to be CrimePulse frontend!" -ForegroundColor Red
        Write-Host "     Skipping to prevent terminating unrelated application." -ForegroundColor Red
        Write-Host "     If you wish to terminate it manually: Stop-Process -Id $($proc3000.ProcessId) -Force" -ForegroundColor DarkGray
    }
}

# -----------------------------------------------------------------------------
# 2. Inspect Port 5000 (Express API Gateway)
# -----------------------------------------------------------------------------
Write-Host "`n[2/3] Checking port 5000 (Express Gateway)..." -ForegroundColor Yellow
$proc5000 = Get-ProcessOnPort -Port 5000

if (-not $proc5000) {
    Write-Host "  ✅ Port 5000 is already free." -ForegroundColor Green
} else {
    Write-Host "  Found process on port 5000: PID $($proc5000.ProcessId) ($($proc5000.Name))" -ForegroundColor Cyan
    Write-Host "  Command: $($proc5000.CommandLine)" -ForegroundColor DarkGray

    # Safety check: confirm process is CrimePulse Node / Express
    $isCrimePulseBackend = ($proc5000.CommandLine -match "server\.js" -or
                            $proc5000.CommandLine -match "nodemon" -or
                            $proc5000.CommandLine -match "backend")

    if ($isCrimePulseBackend) {
        Write-Host "  Stopping CrimePulse Express process (PID: $($proc5000.ProcessId))..." -ForegroundColor Yellow
        try {
            Stop-Process -Id $proc5000.ProcessId -Force -ErrorAction Stop
            Start-Sleep -Milliseconds 500
            Write-Host "  ✅ Successfully stopped Express backend (PID: $($proc5000.ProcessId))." -ForegroundColor Green
        } catch {
            Write-Host "  ❌ Failed to stop PID $($proc5000.ProcessId): $($_.Exception.Message)" -ForegroundColor Red
        }
    } else {
        Write-Host "  ⚠️ Process on port 5000 does NOT appear to be CrimePulse backend!" -ForegroundColor Red
        Write-Host "     Skipping to prevent terminating unrelated application." -ForegroundColor Red
        Write-Host "     If you wish to terminate it manually: Stop-Process -Id $($proc5000.ProcessId) -Force" -ForegroundColor DarkGray
    }
}

# -----------------------------------------------------------------------------
# 3. Inspect Port 8000 (FastAPI ML Service)
# -----------------------------------------------------------------------------
Write-Host "`n[3/3] Checking port 8000 (FastAPI ML Service)..." -ForegroundColor Yellow
$proc8000 = Get-ProcessOnPort -Port 8000

if (-not $proc8000) {
    Write-Host "  ✅ Port 8000 is already free." -ForegroundColor Green
} else {
    Write-Host "  Found process on port 8000: PID $($proc8000.ProcessId) ($($proc8000.Name))" -ForegroundColor Cyan
    Write-Host "  Command: $($proc8000.CommandLine)" -ForegroundColor DarkGray

    # Safety check: confirm process is CrimePulse Uvicorn / FastAPI
    $isCrimePulseMl = ($proc8000.CommandLine -match "uvicorn" -or
                       $proc8000.CommandLine -match "main:app" -or
                       $proc8000.CommandLine -match "ml-service")

    if ($isCrimePulseMl) {
        Write-Host "  Stopping CrimePulse FastAPI process (PID: $($proc8000.ProcessId))..." -ForegroundColor Yellow
        try {
            Stop-Process -Id $proc8000.ProcessId -Force -ErrorAction Stop
            Start-Sleep -Milliseconds 500
            Write-Host "  ✅ Successfully stopped FastAPI ML service (PID: $($proc8000.ProcessId))." -ForegroundColor Green
        } catch {
            Write-Host "  ❌ Failed to stop PID $($proc8000.ProcessId): $($_.Exception.Message)" -ForegroundColor Red
        }
    } else {
        Write-Host "  ⚠️ Process on port 8000 does NOT appear to be CrimePulse FastAPI!" -ForegroundColor Red
        Write-Host "     Skipping to prevent terminating unrelated application." -ForegroundColor Red
        Write-Host "     If you wish to terminate it manually: Stop-Process -Id $($proc8000.ProcessId) -Force" -ForegroundColor DarkGray
    }
}

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Shutdown check completed." -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""
