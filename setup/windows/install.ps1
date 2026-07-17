param(
  [string] $InstallDir = (Get-Location).Path,
  [ValidateSet("Full", "Scan", "InstallRequirements", "Database", "Preflight", "Finalize", "Rollback", "Update")]
  [string] $Phase = "Full",
  [string] $StateFile = "",
  [string] $StatusFile = "",
  [string] $EnvBackupFile = "",
  [string] $BackendEnvBackupFile = "",
  [string] $LogFile = ""
)

$ErrorActionPreference = "Stop"

if (-not $LogFile) {
  $LogFile = Join-Path $env:TEMP "QRRecorderServer-setup.log"
}

function Write-SetupLog([string] $Message) {
  try {
    $directory = Split-Path -Parent $LogFile
    if ($directory  ) {
      New-Item -ItemType Directory -Force -Path $directory | Out-Null
    }
    Add-Content -Path $LogFile -Value "$(Get-Date -Format o) $Message" -Encoding UTF8
  } catch {
    # Logging must never block setup UI.
  }
}

function Escape-IniValue([string] $Value) {
  if ($null -eq $Value) {
    return ""
  }
  return ($Value -replace "`r", " " -replace "`n", " ").Trim()
}

function Write-Status([string] $State, [string] $Message, [hashtable] $Details = @{}) {
  if (-not $StatusFile) {
    return
  }

  $directory = Split-Path -Parent $StatusFile
  if ($directory) {
    New-Item -ItemType Directory -Force -Path $directory | Out-Null
  }

  $lines = New-Object System.Collections.Generic.List[string]
  $lines.Add("[environment]")
  $lines.Add("state=$(Escape-IniValue $State)")
  $lines.Add("message=$(Escape-IniValue $Message)")
  foreach ($key in ($Details.Keys | Sort-Object)) {
    $lines.Add("$key=$(Escape-IniValue ([string] $Details[$key]))")
  }

  Set-Content -Path $StatusFile -Encoding ASCII -Value $lines
}

trap {
  Write-SetupLog "Fatal setup error: $($_.Exception.ToString())"
  try {
    Add-Type -AssemblyName System.Windows.Forms -ErrorAction SilentlyContinue
    [System.Windows.Forms.MessageBox]::Show(
      "Setup failed before the UI could continue:`n`n$($_.Exception.Message)`n`nLog: $LogFile",
      "QR Recorder Server",
      [System.Windows.Forms.MessageBoxButtons]::OK,
      [System.Windows.Forms.MessageBoxIcon]::Error
    ) | Out-Null
  } catch {
    Write-Host "Setup failed: $($_.Exception.Message)"
    Write-Host "Log: $LogFile"
  }
  exit 1
}

Write-SetupLog "Setup phase started: $Phase"

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$SetupRoot = Split-Path -Parent $ScriptRoot
$ConfigPath = Join-Path $SetupRoot "config.json"
$Config = Get-Content -Raw -Encoding UTF8 $ConfigPath | ConvertFrom-Json
$RuntimeDir = Join-Path $InstallDir "resources\runtime"
$BackendDir = Join-Path $RuntimeDir "backend"
$EnvPath = Join-Path $RuntimeDir ".env"
$BackendEnvPath = Join-Path $BackendDir ".env"
$SupportFile = Join-Path $RuntimeDir ".matrix-cache\node.index"
$CreatedDatabaseName = $null
$DatabasePassword = $null

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
  $okButton.Text = "Continue"
  $okButton.Left = 296
  $okButton.Top = 84
  $okButton.Width = 90
  $okButton.DialogResult = [System.Windows.Forms.DialogResult]::OK
  $form.AcceptButton = $okButton
  $form.Controls.Add($okButton)

  $cancelButton = New-Object System.Windows.Forms.Button
  $cancelButton.Text = "Cancel"
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

function Get-ProgramFileRoots {
  $roots = @(
    $env:ProgramW6432,
    $env:ProgramFiles,
    ${env:ProgramFiles(x86)},
    (Join-Path $env:SystemDrive "Program Files"),
    (Join-Path $env:SystemDrive "Program Files (x86)")
  )

  try {
    $roots += [Environment]::GetFolderPath([Environment+SpecialFolder]::ProgramFiles)
  } catch {
  }

  return $roots |
    Where-Object { $_ -and (Test-Path $_) } |
    ForEach-Object { [System.IO.Path]::GetFullPath($_).TrimEnd("\") } |
    Select-Object -Unique
}

function Get-InstalledAppEntries {
  $entries = New-Object System.Collections.Generic.List[object]
  $views = @([Microsoft.Win32.RegistryView]::Registry64, [Microsoft.Win32.RegistryView]::Registry32)
  $hives = @([Microsoft.Win32.RegistryHive]::LocalMachine, [Microsoft.Win32.RegistryHive]::CurrentUser)
  $uninstallPath = "SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall"

  foreach ($hive in $hives) {
    foreach ($view in $views) {
      try {
        $baseKey = [Microsoft.Win32.RegistryKey]::OpenBaseKey($hive, $view)
        $uninstallKey = $baseKey.OpenSubKey($uninstallPath)
        if (-not $uninstallKey) {
          continue
        }

        foreach ($subKeyName in $uninstallKey.GetSubKeyNames()) {
          $subKey = $uninstallKey.OpenSubKey($subKeyName)
          if (-not $subKey) {
            continue
          }

          $displayName = [string] $subKey.GetValue("DisplayName", "")
          if (-not $displayName) {
            continue
          }

          $entries.Add([pscustomobject]@{
            DisplayName = $displayName
            DisplayVersion = [string] $subKey.GetValue("DisplayVersion", "")
            InstallLocation = [string] $subKey.GetValue("InstallLocation", "")
            Publisher = [string] $subKey.GetValue("Publisher", "")
            RegistryView = [string] $view
          }) | Out-Null
        }
      } catch {
        Write-SetupLog "Could not read $hive $view uninstall registry: $($_.Exception.Message)"
      }
    }
  }

  return $entries
}

function Get-InstalledAppEntriesByName([string] $Pattern) {
  return @(Get-InstalledAppEntries | Where-Object { $_.DisplayName -match $Pattern })
}

function Get-PostgreSqlInstallRoots {
  $roots = @()

  foreach ($entry in Get-InstalledAppEntriesByName "PostgreSQL") {
    if ($entry.InstallLocation) {
      $roots += $entry.InstallLocation
    }
  }

  foreach ($programRoot in Get-ProgramFileRoots) {
    $postgresRoot = Join-Path $programRoot "PostgreSQL"
    if (Test-Path $postgresRoot) {
      $roots += (Get-ChildItem -LiteralPath $postgresRoot -Directory -ErrorAction SilentlyContinue | ForEach-Object { $_.FullName })
      $roots += $postgresRoot
    }
  }

  return $roots |
    Where-Object { $_ -and (Test-Path $_) } |
    ForEach-Object { [System.IO.Path]::GetFullPath($_).TrimEnd("\") } |
    Select-Object -Unique
}

function Get-PostgreSqlBinaryCandidates([string] $BinaryName) {
  $candidates = @()
  foreach ($root in Get-PostgreSqlInstallRoots) {
    $candidates += (Join-Path $root "bin\$BinaryName")
  }
  return $candidates | Where-Object { $_ } | Select-Object -Unique
}

function Get-PgAdminExecutableCandidates {
  $candidates = @()

  foreach ($entry in Get-InstalledAppEntriesByName "pgAdmin") {
    if ($entry.InstallLocation) {
      $candidates += (Join-Path $entry.InstallLocation "pgAdmin4.exe")
      $candidates += (Join-Path $entry.InstallLocation "runtime\pgAdmin4.exe")
      $candidates += (Join-Path $entry.InstallLocation "bin\pgAdmin4.exe")
    }
  }

  foreach ($programRoot in Get-ProgramFileRoots) {
    $candidates += (Join-Path $programRoot "pgAdmin 4\pgAdmin4.exe")
    $candidates += (Join-Path $programRoot "pgAdmin 4\runtime\pgAdmin4.exe")
    $candidates += (Join-Path $programRoot "PostgreSQL\*\pgAdmin 4\runtime\pgAdmin4.exe")
  }

  return $candidates | Where-Object { $_ } | Select-Object -Unique
}

function Get-PgAdminPsqlCandidates {
  $candidates = @()

  foreach ($entry in Get-InstalledAppEntriesByName "pgAdmin") {
    if ($entry.InstallLocation) {
      $candidates += (Join-Path $entry.InstallLocation "runtime\psql.exe")
    }
  }

  foreach ($programRoot in Get-ProgramFileRoots) {
    $candidates += (Join-Path $programRoot "pgAdmin 4\runtime\psql.exe")
    $candidates += (Join-Path $programRoot "PostgreSQL\*\pgAdmin 4\runtime\psql.exe")
  }

  return $candidates | Where-Object { $_ } | Select-Object -Unique
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
    $candidates += "$env:ProgramW6432\nodejs\node.exe"
  }
  if ($lowerNames -contains "npm.cmd" -or $lowerNames -contains "npm") {
    $candidates += "$env:ProgramFiles\nodejs\npm.cmd"
    $candidates += "$env:ProgramW6432\nodejs\npm.cmd"
  }
  if ($lowerNames -contains "psql.exe" -or $lowerNames -contains "psql") {
    $candidates += Get-PostgreSqlBinaryCandidates "psql.exe"
    $candidates += Get-PgAdminPsqlCandidates
  }
  if ($lowerNames -contains "postgres.exe" -or $lowerNames -contains "postgres") {
    $candidates += Get-PostgreSqlBinaryCandidates "postgres.exe"
  }

  foreach ($candidate in ($candidates | Where-Object { $_ } | Select-Object -Unique)) {
    $matches = @(Get-ChildItem $candidate -ErrorAction SilentlyContinue | Sort-Object FullName -Descending)
    foreach ($match in $matches) {
      if ($match -and (Test-Path $match.FullName)) {
        return $match.FullName
      }
    }
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
  foreach ($path in Get-PgAdminExecutableCandidates) {
    if (Get-ChildItem $path -ErrorAction SilentlyContinue | Select-Object -First 1) {
      return $true
    }
  }
  return [bool] (Get-Command "pgAdmin4.exe" -ErrorAction SilentlyContinue)
}

function Get-PgAdminVersionText {
  foreach ($entry in Get-InstalledAppEntriesByName "pgAdmin") {
    if ($entry.DisplayVersion) {
      return $entry.DisplayVersion
    }
  }
  if (Test-PgAdminInstalled) {
    return "Installed"
  }
  return "Missing"
}

function Get-PostgreSqlVersionText {
  $postgresPath = Get-FirstCommandPath @("postgres.exe", "postgres")
  $postgresVersion = Get-VersionText $postgresPath @("--version")
  if ($postgresVersion) {
    return $postgresVersion
  }

  foreach ($entry in Get-InstalledAppEntriesByName "PostgreSQL") {
    if ($entry.DisplayVersion) {
      return "PostgreSQL $($entry.DisplayVersion)"
    }
  }

  $psqlPath = Get-FirstCommandPath @("psql.exe", "psql")
  $psqlVersion = Get-VersionText $psqlPath @("--version")
  if ($psqlVersion -and $psqlPath -match "\\PostgreSQL\\") {
    return $psqlVersion
  }

  return $null
}

function Get-RequirementState {
  $nodePath = Get-FirstCommandPath @("node.exe", "node")
  $npmPath = Get-FirstCommandPath @("npm.cmd", "npm")

  $nodeVersion = Get-VersionText $nodePath @("--version")
  $npmVersion = Get-VersionText $npmPath @("--version")
  $postgresVersion = Get-PostgreSqlVersionText
  $pgAdminInstalled = Test-PgAdminInstalled
  $pgAdminVersion = Get-PgAdminVersionText

  return @(
    [pscustomobject]@{
      Name = "Node.js"
      Required = ">= $($Config.requirements.node.minimumMajor)"
      Version = if ($nodeVersion) { $nodeVersion } else { "Missing" }
      State = if ((Get-MajorVersion $nodeVersion) -ge [int]$Config.requirements.node.minimumMajor) { "OK" } elseif ($nodePath) { "Wrong version" } else { "Missing" }
      WingetId = $Config.requirements.node.wingetId
    },
    [pscustomobject]@{
      Name = "npm"
      Required = ">= $($Config.requirements.npm.minimumMajor)"
      Version = if ($npmVersion) { $npmVersion } else { "Missing" }
      State = if ((Get-MajorVersion $npmVersion) -ge [int]$Config.requirements.npm.minimumMajor) { "OK" } elseif ($npmPath) { "Wrong version" } else { "Missing" }
      WingetId = $null
    },
    [pscustomobject]@{
      Name = "PostgreSQL"
      Required = ">= $($Config.requirements.postgresql.minimumMajor)"
      Version = if ($postgresVersion) { $postgresVersion } else { "Missing" }
      State = if ((Get-MajorVersion $postgresVersion) -ge [int]$Config.requirements.postgresql.minimumMajor) { "OK" } elseif ($postgresVersion) { "Wrong version" } else { "Missing" }
      WingetId = $Config.requirements.postgresql.wingetId
    },
    [pscustomobject]@{
      Name = "pgAdmin"
      Required = "Installed"
      Version = $pgAdminVersion
      State = if ($pgAdminInstalled) { "OK" } else { "Missing" }
      WingetId = $Config.requirements.pgAdmin.wingetId
    }
  )
}

function Format-RequirementSummary($Items) {
  return ($Items | ForEach-Object { "- $($_.Name): $($_.State) ($($_.Version), required $($_.Required))" }) -join [Environment]::NewLine
}

function Get-RequirementStatusValue($Items, [string] $Name) {
  $item = $Items | Where-Object { $_.Name -eq $Name } | Select-Object -First 1
  if (-not $item) {
    return "Unknown"
  }
  return "$($item.State) ($($item.Version), required $($item.Required))"
}

function Write-RequirementStatus($Items, [string] $State = "", [string] $Message = "") {
  $missing = @($Items | Where-Object { $_.State -ne "OK" })
  $missingList = ($missing | ForEach-Object { "$($_.Name): $($_.State)" }) -join "; "
  if (-not $State) {
    $State = if ($missing.Count -eq 0) { "ready" } else { "missing" }
  }
  if (-not $Message) {
    $Message = if ($State -eq "ready") {
      "All required runtime frameworks are ready. Click Next to continue setup."
    } elseif ($State -eq "missing") {
      "Missing or unsupported runtime frameworks found. Install them manually and click Check again, or click Next to let setup install them."
    } else {
      "Environment check needs attention."
    }
  }

  Write-Status -State $State -Message $Message -Details @{
    summary = Format-RequirementSummary $Items
    node = Get-RequirementStatusValue $Items "Node.js"
    npm = Get-RequirementStatusValue $Items "npm"
    postgresql = Get-RequirementStatusValue $Items "PostgreSQL"
    pgAdmin = Get-RequirementStatusValue $Items "pgAdmin"
    missingCount = [string] $missing.Count
    missingList = $missingList
    logPath = $LogFile
  }
}

function Install-WingetPackage([string] $PackageId, [string] $Name) {
  $winget = Get-FirstCommandPath @("winget.exe", "winget")
  if (-not $winget) {
    throw "winget was not found. Install App Installer or install $Name manually."
  }

  $arguments = @("install", "--id", $PackageId, "--exact", "--accept-source-agreements", "--accept-package-agreements", "--silent")
  if ($PackageId -eq $Config.requirements.postgresql.wingetId) {
    $arguments += @("--override", "--mode unattended --superpassword $($Config.database.defaultPassword)")
  }

  $process = Start-Process -FilePath $winget -ArgumentList $arguments -Wait -PassThru -WindowStyle Hidden
  if ($process.ExitCode -ne 0) {
    throw "$Name installation failed. ExitCode=$($process.ExitCode)"
  }
}

function Ensure-Requirements {
  $items = Get-RequirementState
  $summary = Format-RequirementSummary $items
  $needsInstall = @($items | Where-Object { $_.State -ne "OK" -and $_.WingetId })

  $message = "Environment check result:" + [Environment]::NewLine + [Environment]::NewLine + $summary
  if ($needsInstall.Count -eq 0) {
    Show-Message "$message`n`nEnvironment is ready. Press OK to continue to database setup."
    return
  }

  if (-not (Confirm-Message "$message`n`nPress Yes to install or update missing/wrong-version components.")) {
    throw "Setup was cancelled before prerequisite installation."
  }

  foreach ($item in $needsInstall) {
    Show-Message "Preparing to install or update $($item.Name)."
    Install-WingetPackage $item.WingetId $item.Name
  }

  $items = Get-RequirementState
  $failed = @($items | Where-Object { $_.State -ne "OK" })
  if ($failed.Count -gt 0) {
    throw "Environment is still not ready:`n$(Format-RequirementSummary $failed)"
  }

  Show-Message "Environment components are ready. Press OK to continue to database setup."
}

function Invoke-RequirementScanPhase {
  Write-SetupLog "Requirement scan started."
  $items = Get-RequirementState
  Write-RequirementStatus $items
  Write-SetupLog "Requirement scan result: $(Format-RequirementSummary $items)"
}

function Invoke-RequirementInstallPhase {
  Write-SetupLog "Requirement install started."
  $items = Get-RequirementState
  $needsInstall = @($items | Where-Object { $_.State -ne "OK" -and $_.WingetId })
  $cannotInstall = @($items | Where-Object { $_.State -ne "OK" -and -not $_.WingetId })

  foreach ($item in $needsInstall) {
    Write-SetupLog "Installing or updating $($item.Name) via winget id $($item.WingetId)."
    Install-WingetPackage $item.WingetId $item.Name
  }

  $items = Get-RequirementState
  Write-RequirementStatus $items
  $failed = @($items | Where-Object { $_.State -ne "OK" })
  if ($failed.Count -gt 0) {
    if ($cannotInstall.Count -gt 0 -and $needsInstall.Count -eq 0) {
      throw "Some required components cannot be installed automatically: $(Format-RequirementSummary $failed)"
    }
    throw "Environment is still not ready: $(Format-RequirementSummary $failed)"
  }

  Write-SetupLog "Requirement install completed."
}

function Get-PsqlPath {
  $path = Get-FirstCommandPath @("psql.exe", "psql")
  if ($path) {
    return $path
  }

  $candidates = @(Get-PostgreSqlBinaryCandidates "psql.exe") + @(Get-PgAdminPsqlCandidates)
  $candidates = $candidates | ForEach-Object { Get-ChildItem $_ -ErrorAction SilentlyContinue } | Sort-Object FullName -Descending
  if ($candidates) {
    return $candidates[0].FullName
  }

  throw "psql.exe was not found."
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

function Test-FactoryCode([string] $Value) {
  return $Value -match "^[A-Za-z0-9_-]{2,32}$"
}

function Ensure-FactoryCode {
  $factoryCode = ""
  while ($true) {
    $factoryCode = Prompt-Text "Factory code" "Enter factory code for this server database. This value will be saved as the default factory code." $factoryCode
    $factoryCode = $factoryCode.Trim().ToUpperInvariant()
    if (Test-FactoryCode $factoryCode) {
      return $factoryCode
    }

    Show-Message "Factory code is required and must use 2-32 characters: A-Z, 0-9, underscore, or hyphen." $Config.appName "Warning"
  }
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

function Get-UpdateRepository {
  if ($env:UPDATE_REPOSITORY -and $env:UPDATE_REPOSITORY.Trim()) {
    return $env:UPDATE_REPOSITORY.Trim()
  }

  if ($env:GITHUB_REPOSITORY -and $env:GITHUB_REPOSITORY.Trim()) {
    return $env:GITHUB_REPOSITORY.Trim()
  }

  if ($Config.updates -and $Config.updates.repository -and $Config.updates.repository.Trim()) {
    return $Config.updates.repository.Trim()
  }

  return ""
}

function Read-EnvFile([string] $Path) {
  $values = @{}
  if (-not $Path -or -not (Test-Path $Path)) {
    return $values
  }

  foreach ($line in Get-Content -Path $Path -Encoding UTF8) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith("#")) {
      continue
    }

    if ($trimmed -notmatch "^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$") {
      continue
    }

    $key = $matches[1]
    $value = $matches[2].Trim()
    if (
      ($value.StartsWith('"') -and $value.EndsWith('"')) -or
      ($value.StartsWith("'") -and $value.EndsWith("'"))
    ) {
      $value = $value.Substring(1, [Math]::Max(0, $value.Length - 2))
    }

    $values[$key] = $value
  }

  return $values
}

function Import-RuntimeEnv {
  foreach ($path in @($EnvPath, $BackendEnvPath)) {
    $values = Read-EnvFile $path
    foreach ($key in $values.Keys) {
      [Environment]::SetEnvironmentVariable([string] $key, [string] $values[$key], "Process")
    }
  }
}

function Copy-EnvFileIfAvailable([string] $TargetPath, [string[]] $CandidatePaths) {
  if (Test-Path $TargetPath) {
    return
  }

  foreach ($candidate in $CandidatePaths) {
    if ($candidate -and (Test-Path $candidate)) {
      $directory = Split-Path -Parent $TargetPath
      if ($directory) {
        New-Item -ItemType Directory -Force -Path $directory | Out-Null
      }
      Copy-Item -LiteralPath $candidate -Destination $TargetPath -Force
      Write-SetupLog "Restored env file $TargetPath from $candidate."
      return
    }
  }
}

function Ensure-UpdateRuntimeEnv {
  $candidates = @($EnvPath, $BackendEnvPath, $EnvBackupFile, $BackendEnvBackupFile) | Where-Object { $_ }
  Copy-EnvFileIfAvailable $EnvPath $candidates
  Copy-EnvFileIfAvailable $BackendEnvPath @($BackendEnvPath, $EnvPath, $BackendEnvBackupFile, $EnvBackupFile)

  $runtimeEnv = Read-EnvFile $EnvPath
  $backendEnv = Read-EnvFile $BackendEnvPath
  $databaseUrl = $backendEnv["DATABASE_URL"]
  if (-not $databaseUrl) {
    $databaseUrl = $runtimeEnv["DATABASE_URL"]
  }

  if (-not $databaseUrl) {
    throw "Existing DATABASE_URL was not found. Update cannot continue without the installed runtime .env."
  }

  Import-RuntimeEnv
}

function Write-RuntimeEnv([string] $DatabaseName, [string] $Password, [string] $FactoryCode) {
  $databaseUrl = "postgresql://$($Config.database.defaultUser):$Password@$($Config.database.host):$($Config.database.port)/$DatabaseName"
  $updateRepository = Get-UpdateRepository
  $content = @"
DATABASE_URL="$databaseUrl"
API_HOST="0.0.0.0"
API_PORT="$($Config.ports.api)"
FRONTEND_PORT="$($Config.ports.frontend)"
SERVER_DISPLAY_NAME="$($Config.appName)"
AUTH_TOKEN_SECRET="$(New-Secret)"
SEED_DEFAULT_ADMINS="0"
SEED_DEV_SUPPORT="1"
SEED_FACTORY_CODE="$FactoryCode"
AHSO_SUPPORT_FILE="$SupportFile"
UPDATE_REPOSITORY="$updateRepository"
"@

  New-Item -ItemType Directory -Force -Path $RuntimeDir | Out-Null
  Set-Content -Path $EnvPath -Value $content -Encoding UTF8
  Set-Content -Path $BackendEnvPath -Value $content -Encoding UTF8
}

function Get-RequiredStateFile {
  if (-not $StateFile) {
    throw "Setup state file path was not provided."
  }
  return $StateFile
}

function Save-SetupState($State) {
  $path = Get-RequiredStateFile
  $directory = Split-Path -Parent $path
  if ($directory) {
    New-Item -ItemType Directory -Force -Path $directory | Out-Null
  }
  $State | ConvertTo-Json -Depth 4 | Set-Content -Path $path -Encoding UTF8
}

function Load-SetupState {
  $path = Get-RequiredStateFile
  if (-not (Test-Path $path)) {
    throw "Setup state file was not found."
  }
  return Get-Content -Raw -Encoding UTF8 $path | ConvertFrom-Json
}

function Ensure-Database {
  $factoryCode = Ensure-FactoryCode
  $password = Prompt-Text "PostgreSQL" "Enter postgres password. For a fresh install, default password is 0123456789." $Config.database.defaultPassword $true
  $script:DatabasePassword = $password
  Invoke-Psql "SELECT 1;" $password | Out-Null

  $databaseName = $Config.database.defaultName
  while ($true) {
    if (-not (Test-DatabaseName $databaseName)) {
      $databaseName = Prompt-Text "Database name" "Database name must use letters, numbers, and underscore only." $Config.database.defaultName
      continue
    }

    $exists = Invoke-Psql "SELECT 1 FROM pg_database WHERE datname='$(Escape-SqlLiteral $databaseName)';" $password
    if ($exists -eq "1") {
      if (Confirm-Message "Database '$databaseName' already exists. Press Yes to reuse it, or No to choose another name.") {
        break
      }
      $databaseName = Prompt-Text "Change database name" "Enter a new database name." "$($Config.database.defaultName)_2"
      continue
    }

    Invoke-Psql "CREATE DATABASE $(Quote-Identifier $databaseName);" $password | Out-Null
    $script:CreatedDatabaseName = $databaseName
    Show-Message "Database '$databaseName' was created."
    break
  }

  return [pscustomobject]@{
    DatabaseName = $databaseName
    DatabasePassword = $password
    DatabaseCreated = [bool] $script:CreatedDatabaseName
    FactoryCode = $factoryCode
  }
}

function Remove-NewDatabaseOnFailure {
  if (-not $script:CreatedDatabaseName -or -not $script:DatabasePassword) {
    return
  }

  try {
    $databaseName = $script:CreatedDatabaseName
    Invoke-Psql "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$(Escape-SqlLiteral $databaseName)';" $script:DatabasePassword | Out-Null
    Invoke-Psql "DROP DATABASE IF EXISTS $(Quote-Identifier $databaseName);" $script:DatabasePassword | Out-Null
  } catch {
    # Cleanup is best effort. NSIS still removes app files and shortcuts.
  }
}

function Invoke-RuntimeDatabaseSetup {
  param(
    [bool] $SeedData = $true,
    [bool] $PreserveServerSettings = $false,
    [bool] $SeedDevSupport = $true
  )

  if (-not (Test-Path $BackendDir)) {
    throw "Runtime backend was not found at $BackendDir."
  }

  Push-Location $BackendDir
  try {
    Import-RuntimeEnv
    $env:AHSO_RUNTIME_ROOT = $RuntimeDir
    $env:AHSO_SUPPORT_FILE = $SupportFile
    $env:SEED_DEFAULT_ADMINS = "0"
    $env:SEED_DEV_SUPPORT = if ($SeedDevSupport) { "1" } else { "0" }
    if ($PreserveServerSettings) {
      $env:SEED_SERVER_SETTINGS = "0"
    }

    $prisma = Join-Path $BackendDir "node_modules\.bin\prisma.cmd"
    if (-not (Test-Path $prisma)) {
      $prisma = Join-Path $BackendDir "node_modules\.bin\prisma"
    }
    & $prisma migrate deploy --schema (Join-Path $BackendDir "prisma\schema.prisma")
    if ($LASTEXITCODE -ne 0) {
      throw "Prisma migration failed."
    }

    if ($SeedData) {
      & node (Join-Path $BackendDir "scripts\seed-users.mjs")
      if ($LASTEXITCODE -ne 0) {
        throw "Seed runtime data failed."
      }
    }
  } finally {
    Pop-Location
    Remove-Item Env:\AHSO_RUNTIME_ROOT -ErrorAction SilentlyContinue
    Remove-Item Env:\AHSO_SUPPORT_FILE -ErrorAction SilentlyContinue
    Remove-Item Env:\SEED_DEFAULT_ADMINS -ErrorAction SilentlyContinue
    Remove-Item Env:\SEED_DEV_SUPPORT -ErrorAction SilentlyContinue
    Remove-Item Env:\SEED_SERVER_SETTINGS -ErrorAction SilentlyContinue
  }
}

function Invoke-PreflightPhase {
  Write-SetupLog "Preflight started."
  Ensure-Requirements
  $state = Ensure-Database
  Save-SetupState $state
  Write-SetupLog "Preflight completed. Database=$($state.DatabaseName), Created=$($state.DatabaseCreated)."
  Show-Message "Initial setup is ready.`n`nDatabase: $($state.DatabaseName)`nContinue the installer to choose folder and copy app files."
}

function Invoke-DatabasePhase {
  Write-SetupLog "Database phase started."
  $state = Ensure-Database
  Save-SetupState $state
  Write-SetupLog "Database phase completed. Database=$($state.DatabaseName), Created=$($state.DatabaseCreated)."
}

function Invoke-FinalizePhase {
  Write-SetupLog "Finalize started."
  $state = Load-SetupState
  $script:DatabasePassword = $state.DatabasePassword
  if ([bool] $state.DatabaseCreated) {
    $script:CreatedDatabaseName = $state.DatabaseName
  }

  Write-RuntimeEnv $state.DatabaseName $state.DatabasePassword $state.FactoryCode
  Invoke-RuntimeDatabaseSetup
  Write-SetupLog "Finalize completed. Database=$($state.DatabaseName), FactoryCode=$($state.FactoryCode)."
  Show-Message "Setup is ready.`n`nDatabase: $($state.DatabaseName)`nFactory code: $($state.FactoryCode)`nNext step: open the app and create the first admin account."
}

function Invoke-FullPhase {
  Write-SetupLog "Full setup started."
  Ensure-Requirements
  $state = Ensure-Database
  Write-RuntimeEnv $state.DatabaseName $state.DatabasePassword $state.FactoryCode
  Invoke-RuntimeDatabaseSetup
  Write-SetupLog "Full setup completed. Database=$($state.DatabaseName), FactoryCode=$($state.FactoryCode)."
  Show-Message "Setup is ready.`n`nDatabase: $($state.DatabaseName)`nFactory code: $($state.FactoryCode)`nNext step: open the app and create the first admin account."
}

function Invoke-UpdatePhase {
  Write-SetupLog "Update phase started."
  Ensure-UpdateRuntimeEnv
  Invoke-RuntimeDatabaseSetup -SeedData $true -PreserveServerSettings $true -SeedDevSupport $false
  Write-SetupLog "Update phase completed. Existing runtime env and database were preserved."
}

function Invoke-RollbackPhase {
  Write-SetupLog "Rollback started."
  $state = Load-SetupState
  $script:DatabasePassword = $state.DatabasePassword
  if ([bool] $state.DatabaseCreated) {
    $script:CreatedDatabaseName = $state.DatabaseName
    Remove-NewDatabaseOnFailure
    Write-SetupLog "Rollback removed created database: $($state.DatabaseName)."
  }
}

try {
  switch ($Phase) {
    "Scan" { Invoke-RequirementScanPhase; break }
    "InstallRequirements" { Invoke-RequirementInstallPhase; break }
    "Database" { Invoke-DatabasePhase; break }
    "Preflight" { Invoke-PreflightPhase; break }
    "Finalize" { Invoke-FinalizePhase; break }
    "Rollback" { Invoke-RollbackPhase; break }
    "Update" { Invoke-UpdatePhase; break }
    default { Invoke-FullPhase; break }
  }
} catch {
  Write-SetupLog "Setup error: $($_.Exception.ToString())"
  if ($Phase -in @("Scan", "InstallRequirements")) {
    Write-Status -State "failed" -Message $_.Exception.Message -Details @{
      summary = "Environment setup failed."
      logPath = $LogFile
    }
  }
  Remove-NewDatabaseOnFailure
  if ($Phase -notin @("Scan", "InstallRequirements", "Update")) {
    Show-Message "Setup was not completed:`n`n$($_.Exception.Message)`n`nLog: $LogFile" $Config.appName "Error"
  }
  exit 1
}
