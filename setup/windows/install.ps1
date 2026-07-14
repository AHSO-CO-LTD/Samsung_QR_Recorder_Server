param(
  [string] $InstallDir = (Get-Location).Path
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$SetupRoot = Split-Path -Parent $ScriptRoot
$ConfigPath = Join-Path $SetupRoot "config.json"
$Config = Get-Content -Raw -Encoding UTF8 $ConfigPath | ConvertFrom-Json
$RuntimeDir = Join-Path $InstallDir "resources\runtime"
$BackendDir = Join-Path $RuntimeDir "backend"
$SupportFile = Join-Path $RuntimeDir ".matrix-cache\node.index"

function Show-Message([string] $Message, [string] $Title = $Config.appName, [string] $Icon = "Information") {
  [System.Windows.Forms.MessageBox]::Show($Message, $Title, [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::$Icon) | Out-Null
}

function Confirm-Message([string] $Message, [string] $Title = $Config.appName) {
  $result = [System.Windows.Forms.MessageBox]::Show($Message, $Title, [System.Windows.Forms.MessageBoxButtons]::YesNo, [System.Windows.Forms.MessageBoxIcon]::Question)
  return $result -eq [System.Windows.Forms.DialogResult]::Yes
}

function Prompt-Text([string] $Title, [string] $Label, [string] $DefaultValue = "", [bool] $IsPassword = $false) {
  $form = New-Object System.Windows.Forms.Form
  $form.Text = $Title
  $form.StartPosition = "CenterScreen"
  $form.Width = 520
  $form.Height = 170
  $form.FormBorderStyle = "FixedDialog"
  $form.MaximizeBox = $false
  $form.MinimizeBox = $false

  $labelControl = New-Object System.Windows.Forms.Label
  $labelControl.Text = $Label
  $labelControl.AutoSize = $true
  $labelControl.Left = 16
  $labelControl.Top = 18
  $form.Controls.Add($labelControl)

  $textBox = New-Object System.Windows.Forms.TextBox
  $textBox.Left = 16
  $textBox.Top = 46
  $textBox.Width = 470
  $textBox.Text = $DefaultValue
  $textBox.UseSystemPasswordChar = $IsPassword
  $form.Controls.Add($textBox)

  $okButton = New-Object System.Windows.Forms.Button
  $okButton.Text = "Tiếp tục"
  $okButton.Left = 296
  $okButton.Top = 84
  $okButton.Width = 90
  $okButton.DialogResult = [System.Windows.Forms.DialogResult]::OK
  $form.AcceptButton = $okButton
  $form.Controls.Add($okButton)

  $cancelButton = New-Object System.Windows.Forms.Button
  $cancelButton.Text = "Hủy"
  $cancelButton.Left = 396
  $cancelButton.Top = 84
  $cancelButton.Width = 90
  $cancelButton.DialogResult = [System.Windows.Forms.DialogResult]::Cancel
  $form.CancelButton = $cancelButton
  $form.Controls.Add($cancelButton)

  $result = $form.ShowDialog()
  if ($result -ne [System.Windows.Forms.DialogResult]::OK) {
    throw "Setup was cancelled."
  }

  return $textBox.Text.Trim()
}

function Get-FirstCommandPath([string[]] $Names) {
  foreach ($name in $Names) {
    $command = Get-Command $name -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($command) {
      return $command.Source
    }
  }

  $lowerNames = $Names | ForEach-Object { $_.ToLowerInvariant() }
  $candidates = @()
  if ($lowerNames -contains "node.exe" -or $lowerNames -contains "node") {
    $candidates += "$env:ProgramFiles\nodejs\node.exe"
  }
  if ($lowerNames -contains "npm.cmd" -or $lowerNames -contains "npm") {
    $candidates += "$env:ProgramFiles\nodejs\npm.cmd"
  }
  if ($lowerNames -contains "psql.exe" -or $lowerNames -contains "psql") {
    $candidates += (Get-ChildItem "$env:ProgramFiles\PostgreSQL\*\bin\psql.exe" -ErrorAction SilentlyContinue | Sort-Object FullName -Descending | ForEach-Object { $_.FullName })
  }
  if ($lowerNames -contains "postgres.exe" -or $lowerNames -contains "postgres") {
    $candidates += (Get-ChildItem "$env:ProgramFiles\PostgreSQL\*\bin\postgres.exe" -ErrorAction SilentlyContinue | Sort-Object FullName -Descending | ForEach-Object { $_.FullName })
  }

  foreach ($candidate in $candidates) {
    if ($candidate -and (Test-Path $candidate)) {
      return $candidate
    }
  }

  return $null
}

function Get-VersionText([string] $CommandPath, [string[]] $Arguments) {
  if (-not $CommandPath) {
    return $null
  }
  try {
    return (& $CommandPath @Arguments 2>$null | Select-Object -First 1)
  } catch {
    return $null
  }
}

function Get-MajorVersion([string] $Text) {
  if (-not $Text) {
    return $null
  }
  $match = [regex]::Match($Text, "(\d+)\.")
  if ($match.Success) {
    return [int] $match.Groups[1].Value
  }
  return $null
}

function Test-PgAdminInstalled {
  $paths = @(
    "$env:ProgramFiles\PostgreSQL\*\pgAdmin 4\runtime\pgAdmin4.exe",
    "${env:ProgramFiles(x86)}\PostgreSQL\*\pgAdmin 4\runtime\pgAdmin4.exe"
  )
  foreach ($path in $paths) {
    if (Get-ChildItem $path -ErrorAction SilentlyContinue | Select-Object -First 1) {
      return $true
    }
  }
  return [bool] (Get-Command "pgAdmin4.exe" -ErrorAction SilentlyContinue)
}

function Get-RequirementState {
  $nodePath = Get-FirstCommandPath @("node.exe", "node")
  $npmPath = Get-FirstCommandPath @("npm.cmd", "npm")
  $psqlPath = Get-FirstCommandPath @("psql.exe", "psql")
  $postgresPath = Get-FirstCommandPath @("postgres.exe", "postgres")

  $nodeVersion = Get-VersionText $nodePath @("--version")
  $npmVersion = Get-VersionText $npmPath @("--version")
  $postgresVersion = Get-VersionText $psqlPath @("--version")
  if (-not $postgresVersion) {
    $postgresVersion = Get-VersionText $postgresPath @("--version")
  }

  return @(
    [pscustomobject]@{
      Name = "Node.js"
      Required = ">= $($Config.requirements.node.minimumMajor)"
      Version = if ($nodeVersion) { $nodeVersion } else { "Chưa có" }
      State = if ((Get-MajorVersion $nodeVersion) -ge [int]$Config.requirements.node.minimumMajor) { "OK" } elseif ($nodePath) { "Sai phiên bản" } else { "Thiếu" }
      WingetId = $Config.requirements.node.wingetId
    },
    [pscustomobject]@{
      Name = "npm"
      Required = ">= $($Config.requirements.npm.minimumMajor)"
      Version = if ($npmVersion) { $npmVersion } else { "Chưa có" }
      State = if ((Get-MajorVersion $npmVersion) -ge [int]$Config.requirements.npm.minimumMajor) { "OK" } elseif ($npmPath) { "Sai phiên bản" } else { "Thiếu" }
      WingetId = $null
    },
    [pscustomobject]@{
      Name = "PostgreSQL"
      Required = ">= $($Config.requirements.postgresql.minimumMajor)"
      Version = if ($postgresVersion) { $postgresVersion } else { "Chưa có" }
      State = if ((Get-MajorVersion $postgresVersion) -ge [int]$Config.requirements.postgresql.minimumMajor) { "OK" } elseif ($postgresVersion) { "Sai phiên bản" } else { "Thiếu" }
      WingetId = $Config.requirements.postgresql.wingetId
    },
    [pscustomobject]@{
      Name = "pgAdmin"
      Required = "Installed"
      Version = if (Test-PgAdminInstalled) { "Đã có" } else { "Chưa có" }
      State = if (Test-PgAdminInstalled) { "OK" } else { "Thiếu" }
      WingetId = $Config.requirements.pgAdmin.wingetId
    }
  )
}

function Format-RequirementSummary($Items) {
  return ($Items | ForEach-Object { "- $($_.Name): $($_.State) ($($_.Version), yêu cầu $($_.Required))" }) -join [Environment]::NewLine
}

function Install-WingetPackage([string] $PackageId, [string] $Name) {
  $winget = Get-FirstCommandPath @("winget.exe", "winget")
  if (-not $winget) {
    throw "Không tìm thấy winget để cài $Name. Vui lòng cài App Installer hoặc cài $Name thủ công."
  }

  $arguments = @("install", "--id", $PackageId, "--exact", "--accept-source-agreements", "--accept-package-agreements", "--silent")
  if ($PackageId -eq $Config.requirements.postgresql.wingetId) {
    $arguments += @("--override", "--mode unattended --superpassword $($Config.database.defaultPassword)")
  }

  $process = Start-Process -FilePath $winget -ArgumentList $arguments -Wait -PassThru -WindowStyle Hidden
  if ($process.ExitCode -ne 0) {
    throw "Cài $Name thất bại. ExitCode=$($process.ExitCode)"
  }
}

function Ensure-Requirements {
  $items = Get-RequirementState
  $summary = Format-RequirementSummary $items
  $needsInstall = @($items | Where-Object { $_.State -ne "OK" -and $_.WingetId })

  $message = "Kết quả kiểm tra môi trường:" + [Environment]::NewLine + [Environment]::NewLine + $summary
  if ($needsInstall.Count -eq 0) {
    Show-Message "$message`n`nMôi trường đã sẵn sàng. Bấm OK để qua bước database."
    return
  }

  if (-not (Confirm-Message "$message`n`nBấm Yes để cài/cập nhật phần còn thiếu hoặc sai phiên bản.")) {
    throw "Setup was cancelled before prerequisite installation."
  }

  foreach ($item in $needsInstall) {
    Show-Message "Chuẩn bị cài/cập nhật $($item.Name)."
    Install-WingetPackage $item.WingetId $item.Name
  }

  $items = Get-RequirementState
  $failed = @($items | Where-Object { $_.State -ne "OK" })
  if ($failed.Count -gt 0) {
    throw "Vẫn còn môi trường chưa sẵn sàng:`n$(Format-RequirementSummary $failed)"
  }

  Show-Message "Đã cài đủ môi trường. Bấm OK để qua bước database."
}

function Get-PsqlPath {
  $path = Get-FirstCommandPath @("psql.exe", "psql")
  if ($path) {
    return $path
  }

  $candidates = Get-ChildItem "$env:ProgramFiles\PostgreSQL\*\bin\psql.exe" -ErrorAction SilentlyContinue | Sort-Object FullName -Descending
  if ($candidates) {
    return $candidates[0].FullName
  }

  throw "Không tìm thấy psql.exe."
}

function Invoke-Psql([string] $Sql, [string] $Password, [string] $Database = "postgres") {
  $psql = Get-PsqlPath
  $env:PGPASSWORD = $Password
  try {
    $output = & $psql -h $Config.database.host -p $Config.database.port -U $Config.database.defaultUser -d $Database -t -A -c $Sql 2>&1
    if ($LASTEXITCODE -ne 0) {
      throw ($output -join [Environment]::NewLine)
    }
    return ($output -join [Environment]::NewLine).Trim()
  } finally {
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
  }
}

function Test-DatabaseName([string] $Name) {
  return $Name -match "^[A-Za-z_][A-Za-z0-9_]*$"
}

function Escape-SqlLiteral([string] $Value) {
  return $Value.Replace("'", "''")
}

function Quote-Identifier([string] $Value) {
  return '"' + $Value.Replace('"', '""') + '"'
}

function New-Secret {
  $bytes = New-Object byte[] 32
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  return [Convert]::ToBase64String($bytes).TrimEnd("=").Replace("+", "-").Replace("/", "_")
}

function Write-RuntimeEnv([string] $DatabaseName, [string] $Password) {
  $databaseUrl = "postgresql://$($Config.database.defaultUser):$Password@$($Config.database.host):$($Config.database.port)/$DatabaseName"
  $content = @"
DATABASE_URL="$databaseUrl"
API_HOST="0.0.0.0"
API_PORT="$($Config.ports.api)"
FRONTEND_PORT="$($Config.ports.frontend)"
SERVER_DISPLAY_NAME="$($Config.appName)"
AUTH_TOKEN_SECRET="$(New-Secret)"
SEED_DEFAULT_ADMINS="0"
SEED_DEV_SUPPORT="1"
AHSO_SUPPORT_FILE="$SupportFile"
UPDATE_REPOSITORY="$env:GITHUB_REPOSITORY"
"@

  New-Item -ItemType Directory -Force -Path $RuntimeDir | Out-Null
  Set-Content -Path (Join-Path $RuntimeDir ".env") -Value $content -Encoding UTF8
  Set-Content -Path (Join-Path $BackendDir ".env") -Value $content -Encoding UTF8
}

function Ensure-Database {
  $password = Prompt-Text "PostgreSQL" "Nhập mật khẩu tài khoản postgres. Nếu mới cài, mật khẩu mặc định là 0123456789." $Config.database.defaultPassword $true
  Invoke-Psql "SELECT 1;" $password | Out-Null

  $databaseName = $Config.database.defaultName
  while ($true) {
    if (-not (Test-DatabaseName $databaseName)) {
      $databaseName = Prompt-Text "Tên database" "Tên database chỉ dùng chữ, số và dấu gạch dưới." $Config.database.defaultName
      continue
    }

    $exists = Invoke-Psql "SELECT 1 FROM pg_database WHERE datname='$(Escape-SqlLiteral $databaseName)';" $password
    if ($exists -eq "1") {
      if (Confirm-Message "Database '$databaseName' đã tồn tại. Bấm Yes để dùng tiếp database này, bấm No để đổi tên.") {
        break
      }
      $databaseName = Prompt-Text "Đổi tên database" "Nhập tên database mới." "$($Config.database.defaultName)_2"
      continue
    }

    Invoke-Psql "CREATE DATABASE $(Quote-Identifier $databaseName);" $password | Out-Null
    Show-Message "Đã tạo database '$databaseName'."
    break
  }

  Write-RuntimeEnv $databaseName $password
  return $databaseName
}

function Invoke-RuntimeDatabaseSetup {
  if (-not (Test-Path $BackendDir)) {
    throw "Không tìm thấy runtime backend tại $BackendDir."
  }

  Push-Location $BackendDir
  try {
    $env:AHSO_RUNTIME_ROOT = $RuntimeDir
    $env:AHSO_SUPPORT_FILE = $SupportFile
    $env:SEED_DEFAULT_ADMINS = "0"
    $env:SEED_DEV_SUPPORT = "1"

    $prisma = Join-Path $BackendDir "node_modules\.bin\prisma.cmd"
    if (-not (Test-Path $prisma)) {
      $prisma = Join-Path $BackendDir "node_modules\.bin\prisma"
    }
    & $prisma migrate deploy --schema (Join-Path $BackendDir "prisma\schema.prisma")
    if ($LASTEXITCODE -ne 0) {
      throw "Prisma migration failed."
    }

    & node (Join-Path $BackendDir "scripts\seed-users.mjs")
    if ($LASTEXITCODE -ne 0) {
      throw "Seed runtime data failed."
    }
  } finally {
    Pop-Location
    Remove-Item Env:\AHSO_RUNTIME_ROOT -ErrorAction SilentlyContinue
    Remove-Item Env:\AHSO_SUPPORT_FILE -ErrorAction SilentlyContinue
    Remove-Item Env:\SEED_DEFAULT_ADMINS -ErrorAction SilentlyContinue
    Remove-Item Env:\SEED_DEV_SUPPORT -ErrorAction SilentlyContinue
  }
}

try {
  Ensure-Requirements
  $databaseName = Ensure-Database
  Invoke-RuntimeDatabaseSetup
  Show-Message "Cài đặt đã sẵn sàng.`n`nDatabase: $databaseName`nBước tiếp theo: mở app và tạo tài khoản admin đầu tiên."
} catch {
  Show-Message "Setup chưa hoàn tất:`n`n$($_.Exception.Message)" $Config.appName "Error"
  exit 1
}
