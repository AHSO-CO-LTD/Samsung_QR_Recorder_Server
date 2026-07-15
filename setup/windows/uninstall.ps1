param(
  [string] $InstallDir = (Get-Location).Path,
  [ValidateSet("Full", "KeepDatabase", "KeepFramework", "KeepBoth")]
  [string] $Mode = "",
  [switch] $SelectOnly,
  [string] $ModeFile = ""
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Windows.Forms

$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$SetupRoot = Split-Path -Parent $ScriptRoot
$Config = Get-Content -Raw -Encoding UTF8 (Join-Path $SetupRoot "config.json") | ConvertFrom-Json
$RuntimeDir = Join-Path $InstallDir "resources\runtime"
$EnvPath = Join-Path $RuntimeDir ".env"

function Show-Message([string] $Message, [string] $Icon = "Information") {
  [System.Windows.Forms.MessageBox]::Show($Message, $Config.appName, [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::$Icon) | Out-Null
}

function Choose-Mode {
  $form = New-Object System.Windows.Forms.Form
  $form.Text = "Uninstall"
  $form.StartPosition = "CenterScreen"
  $form.Width = 520
  $form.Height = 260
  $form.FormBorderStyle = "FixedDialog"
  $form.MaximizeBox = $false
  $form.MinimizeBox = $false

  $label = New-Object System.Windows.Forms.Label
  $label.Text = "Choose uninstall scope before continuing:"
  $label.Left = 16
  $label.Top = 16
  $label.Width = 460
  $form.Controls.Add($label)

  $options = @(
    @("Full", "Remove app, database, Node.js, PostgreSQL, pgAdmin"),
    @("KeepDatabase", "Keep database, remove app and frameworks"),
    @("KeepFramework", "Keep Node.js/PostgreSQL/pgAdmin, remove app and database"),
    @("KeepBoth", "Remove app only")
  )

  $buttons = @()
  for ($i = 0; $i -lt $options.Count; $i++) {
    $radio = New-Object System.Windows.Forms.RadioButton
    $radio.Text = $options[$i][1]
    $radio.Tag = $options[$i][0]
    $radio.Left = 24
    $radio.Top = 48 + ($i * 28)
    $radio.Width = 420
    if ($i -eq 3) {
      $radio.Checked = $true
    }
    $buttons += $radio
    $form.Controls.Add($radio)
  }

  $ok = New-Object System.Windows.Forms.Button
  $ok.Text = "Continue"
  $ok.Left = 296
  $ok.Top = 176
  $ok.Width = 90
  $ok.DialogResult = [System.Windows.Forms.DialogResult]::OK
  $form.AcceptButton = $ok
  $form.Controls.Add($ok)

  $cancel = New-Object System.Windows.Forms.Button
  $cancel.Text = "Cancel"
  $cancel.Left = 396
  $cancel.Top = 176
  $cancel.Width = 90
  $cancel.DialogResult = [System.Windows.Forms.DialogResult]::Cancel
  $form.CancelButton = $cancel
  $form.Controls.Add($cancel)

  if ($form.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) {
    throw "Uninstall was cancelled."
  }

  return ($buttons | Where-Object { $_.Checked } | Select-Object -First 1).Tag
}

function Resolve-Mode {
  if ($Mode) {
    return $Mode
  }

  if ($ModeFile -and (Test-Path $ModeFile)) {
    $savedMode = (Get-Content -Raw -Encoding UTF8 $ModeFile).Trim()
    if (@("Full", "KeepDatabase", "KeepFramework", "KeepBoth") -contains $savedMode) {
      return $savedMode
    }
  }

  return Choose-Mode
}

function Read-EnvFile {
  $values = @{}
  if (-not (Test-Path $EnvPath)) {
    return $values
  }

  foreach ($line in Get-Content -Encoding UTF8 $EnvPath) {
    if ($line -match "^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$") {
      $values[$matches[1]] = $matches[2].Trim().Trim('"')
    }
  }
  return $values
}

function Parse-DatabaseUrl([string] $Url) {
  $uri = [Uri] $Url
  $userInfo = $uri.UserInfo.Split(":", 2)
  return [pscustomobject]@{
    Host = $uri.Host
    Port = if ($uri.Port -gt 0) { $uri.Port } else { 5432 }
    User = [Uri]::UnescapeDataString($userInfo[0])
    Password = if ($userInfo.Count -gt 1) { [Uri]::UnescapeDataString($userInfo[1]) } else { "" }
    Database = $uri.AbsolutePath.TrimStart("/")
  }
}

function Get-PsqlPath {
  $command = Get-Command "psql.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($command) {
    return $command.Source
  }
  $candidate = Get-ChildItem "$env:ProgramFiles\PostgreSQL\*\bin\psql.exe" -ErrorAction SilentlyContinue | Sort-Object FullName -Descending | Select-Object -First 1
  if ($candidate) {
    return $candidate.FullName
  }
  throw "psql.exe was not found."
}

function Drop-Database {
  $envValues = Read-EnvFile
  if (-not $envValues.DATABASE_URL) {
    Show-Message "DATABASE_URL was not found. Database removal will be skipped." "Warning"
    return
  }

  $db = Parse-DatabaseUrl $envValues.DATABASE_URL
  $confirm = [System.Windows.Forms.MessageBox]::Show("Remove database '$($db.Database)'?", $Config.appName, [System.Windows.Forms.MessageBoxButtons]::YesNo, [System.Windows.Forms.MessageBoxIcon]::Warning)
  if ($confirm -ne [System.Windows.Forms.DialogResult]::Yes) {
    return
  }

  $psql = Get-PsqlPath
  $env:PGPASSWORD = $db.Password
  try {
    & $psql -h $db.Host -p $db.Port -U $db.User -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$($db.Database.Replace("'", "''"))';"
    & $psql -h $db.Host -p $db.Port -U $db.User -d postgres -c "DROP DATABASE IF EXISTS ""$($db.Database.Replace('"', '""'))"";"
  } finally {
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
  }
}

function Uninstall-WingetPackage([string] $PackageId) {
  $winget = Get-Command "winget.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $winget) {
    Show-Message "winget was not found. Skipping $PackageId removal." "Warning"
    return
  }
  Start-Process -FilePath $winget.Source -ArgumentList @("uninstall", "--id", $PackageId, "--exact", "--silent", "--accept-source-agreements") -Wait -WindowStyle Hidden | Out-Null
}

try {
  $Mode = Resolve-Mode

  if ($SelectOnly) {
    if (-not $ModeFile) {
      throw "Mode file path is required."
    }
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $ModeFile) | Out-Null
    Set-Content -Path $ModeFile -Value $Mode -Encoding UTF8
    exit 0
  }

  if ($Mode -eq "Full" -or $Mode -eq "KeepFramework") {
    Drop-Database
  }

  if ($Mode -eq "Full" -or $Mode -eq "KeepDatabase") {
    Uninstall-WingetPackage $Config.requirements.node.wingetId
    Uninstall-WingetPackage $Config.requirements.pgAdmin.wingetId
    Uninstall-WingetPackage $Config.requirements.postgresql.wingetId
  }

  Show-Message "Uninstall scope was processed. The app uninstaller will continue removing app files."
} catch {
  Show-Message "Uninstall was not completed:`n`n$($_.Exception.Message)" "Error"
  exit 1
}
