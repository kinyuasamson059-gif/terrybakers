$ErrorActionPreference = 'Stop'

try {
    $appRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
    $appUrl = 'http://127.0.0.1:5000'
    $node = Get-Command node -ErrorAction SilentlyContinue

    if (-not $node) {
        throw 'Node.js was not found. Install Node.js, then click the Terry Bakers shortcut again.'
    }

    $frontendBuild = Join-Path $appRoot 'frontend\dist\index.html'
    if (-not (Test-Path $frontendBuild)) {
        Push-Location (Join-Path $appRoot 'frontend')
        try {
            & npm.cmd run build
            if ($LASTEXITCODE -ne 0) {
                throw 'The frontend build failed. Check that frontend dependencies are installed and try again.'
            }
        }
        finally {
            Pop-Location
        }
    }

    function Test-TerryBakersServer {
        try {
            $request = [System.Net.WebRequest]::Create("$appUrl/api/health")
            $request.Timeout = 1000
            $response = $request.GetResponse()
            try {
                $reader = New-Object System.IO.StreamReader($response.GetResponseStream())
                try {
                    $health = ConvertFrom-Json $reader.ReadToEnd()
                }
                finally {
                    $reader.Dispose()
                }
            }
            finally {
                $response.Dispose()
            }

            if ($health.system -and $health.system -ne 'Terry Bakers Production & Management System') {
                throw "Port 5000 is already serving a different app: $($health.system)"
            }
            return $health.system -eq 'Terry Bakers Production & Management System'
        }
        catch [System.Net.WebException] {
            return $false
        }
    }

    if (-not (Test-TerryBakersServer)) {
        Start-Process -FilePath $node.Source `
            -ArgumentList 'backend\src\server.js' `
            -WorkingDirectory $appRoot `
            -WindowStyle Minimized

        $serverReady = $false
        for ($attempt = 0; $attempt -lt 30; $attempt++) {
            Start-Sleep -Seconds 1
            if (Test-TerryBakersServer) {
                $serverReady = $true
                break
            }
        }

        if (-not $serverReady) {
            throw 'Terry Bakers did not start. Check that port 5000 is available and try again.'
        }
    }

    Start-Process $appUrl
}
catch {
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.MessageBox]::Show(
        $_.Exception.Message,
        'Terry Bakers startup error',
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Error
    ) | Out-Null
    exit 1
}
