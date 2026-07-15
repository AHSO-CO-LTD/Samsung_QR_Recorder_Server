!macro AhsoCreateReadOnlyScrollBox X Y W H OUTVAR
  nsDialogs::CreateControl EDIT 0x54000000|0x00010000|0x00200000|0x0004|0x0040|0x0800 0x00000200 ${X} ${Y} ${W} ${H} ""
  Pop ${OUTVAR}
!macroend

!ifndef BUILD_UNINSTALLER
!include nsDialogs.nsh
!include LogicLib.nsh

!define MUI_CUSTOMFUNCTION_ABORT AhsoOnAbort

Var AhsoSetupStateFile
Var AhsoSetupLogFile
Var AhsoEnvStatusPath
Var AhsoEnvMode
Var AhsoEnvState
Var AhsoEnvMessage
Var AhsoEnvSummary
Var AhsoEnvNode
Var AhsoEnvNpm
Var AhsoEnvPostgresql
Var AhsoEnvPgAdmin
Var AhsoEnvMissingCount
Var AhsoEnvMissingList
Var AhsoEnvTitleLabel
Var AhsoEnvBodyBox
Var AhsoEnvStatusBox
Var AhsoEnvActionLabel
Var AhsoEnvRecheckButton

!macro customWelcomePage
  Page custom AhsoSetupIntroPageCreate AhsoSetupIntroPageLeave
  Page custom AhsoEnvironmentReviewPageCreate AhsoEnvironmentReviewPageLeave
!macroend

!macro customHeader
  Function AhsoExtractSetupScripts
    InitPluginsDir
    StrCpy $AhsoSetupStateFile "$PLUGINSDIR\ahso-setup-state.json"
    StrCpy $AhsoSetupLogFile "$TEMP\QRRecorderServer-setup.log"
    StrCpy $AhsoEnvStatusPath "$PLUGINSDIR\ahso-environment.ini"

    SetOutPath "$PLUGINSDIR\ahso-setup"
    File /oname=config.json "${PROJECT_DIR}\..\setup\config.json"
    SetOutPath "$PLUGINSDIR\ahso-setup\windows"
    File /oname=install.ps1 "${PROJECT_DIR}\..\setup\windows\install.ps1"
  FunctionEnd

  Function AhsoReadEnvironmentStatus
    ReadINIStr $AhsoEnvState "$AhsoEnvStatusPath" "environment" "state"
    ReadINIStr $AhsoEnvMessage "$AhsoEnvStatusPath" "environment" "message"
    ReadINIStr $AhsoEnvSummary "$AhsoEnvStatusPath" "environment" "summary"
    ReadINIStr $AhsoEnvNode "$AhsoEnvStatusPath" "environment" "node"
    ReadINIStr $AhsoEnvNpm "$AhsoEnvStatusPath" "environment" "npm"
    ReadINIStr $AhsoEnvPostgresql "$AhsoEnvStatusPath" "environment" "postgresql"
    ReadINIStr $AhsoEnvPgAdmin "$AhsoEnvStatusPath" "environment" "pgAdmin"
    ReadINIStr $AhsoEnvMissingCount "$AhsoEnvStatusPath" "environment" "missingCount"
    ReadINIStr $AhsoEnvMissingList "$AhsoEnvStatusPath" "environment" "missingList"

    ${If} $AhsoEnvMessage == ""
      StrCpy $AhsoEnvMessage "Environment check did not return detail."
    ${EndIf}
  FunctionEnd

  Function AhsoRunEnvironmentPhase
    Call AhsoExtractSetupScripts
    Delete "$AhsoEnvStatusPath"
    DetailPrint "Running QR Recorder environment $AhsoEnvMode..."
    ExecWait '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -STA -ExecutionPolicy Bypass -WindowStyle Hidden -File "$PLUGINSDIR\ahso-setup\windows\install.ps1" -Phase "$AhsoEnvMode" -InstallDir "$INSTDIR" -StateFile "$AhsoSetupStateFile" -StatusFile "$AhsoEnvStatusPath" -LogFile "$AhsoSetupLogFile"' $0
    Call AhsoReadEnvironmentStatus

    ${If} $AhsoEnvState == ""
      StrCpy $AhsoEnvState "failed"
      StrCpy $AhsoEnvMessage "Environment $AhsoEnvMode returned code $0. No status file was created."
    ${EndIf}
  FunctionEnd

  Function AhsoRollbackSetupState
    StrCmp $AhsoSetupStateFile "" rollback_done
    IfFileExists "$AhsoSetupStateFile" 0 rollback_done
      ExecWait '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -STA -ExecutionPolicy Bypass -WindowStyle Hidden -File "$PLUGINSDIR\ahso-setup\windows\install.ps1" -Phase Rollback -InstallDir "$INSTDIR" -StateFile "$AhsoSetupStateFile" -LogFile "$AhsoSetupLogFile"'
      Delete "$AhsoSetupStateFile"
    rollback_done:
  FunctionEnd

  Function AhsoOnAbort
    Call AhsoRollbackSetupState
    RMDir "$INSTDIR"
  FunctionEnd

  Function AhsoSetupIntroPageCreate
    !insertmacro MUI_HEADER_TEXT "Setup check" "Check required runtime frameworks before installing"
    nsDialogs::Create 1018
    Pop $0
    ${If} $0 == error
      Abort
    ${EndIf}

    ${NSD_CreateLabel} 0u 0u 300u 22u "Step 1: check required runtime frameworks."
    Pop $0

    !insertmacro AhsoCreateReadOnlyScrollBox 0u 30u 300u 70u $0
    ${NSD_SetText} $0 "Setup will scan this PC for Node.js, npm, PostgreSQL, and pgAdmin first. If anything is missing or unsupported, you can install it manually and click Check again, or click Next to let setup install the missing runtime components."

    ${NSD_CreateLabel} 0u 116u 300u 30u "Click Next to scan the environment before database setup starts."
    Pop $0

    nsDialogs::Show
  FunctionEnd

  Function AhsoSetupIntroPageLeave
    StrCpy $AhsoEnvMode "Scan"
    Call AhsoRunEnvironmentPhase
  FunctionEnd

  Function AhsoEnvironmentReviewPageCreate
    ${If} $AhsoEnvState == ""
      Abort
    ${EndIf}

    nsDialogs::Create 1018
    Pop $0
    ${If} $0 == error
      Abort
    ${EndIf}

    ${NSD_CreateLabel} 0u 0u 300u 20u ""
    Pop $AhsoEnvTitleLabel

    !insertmacro AhsoCreateReadOnlyScrollBox 0u 28u 300u 46u $AhsoEnvBodyBox
    !insertmacro AhsoCreateReadOnlyScrollBox 0u 82u 300u 62u $AhsoEnvStatusBox

    ${NSD_CreateLabel} 0u 152u 198u 18u ""
    Pop $AhsoEnvActionLabel

    ${NSD_CreateButton} 210u 150u 80u 16u "Check again"
    Pop $AhsoEnvRecheckButton
    ${NSD_OnClick} $AhsoEnvRecheckButton AhsoEnvironmentRecheckClicked

    Call AhsoRefreshEnvironmentReview
    nsDialogs::Show
  FunctionEnd

  Function AhsoEnvironmentReviewPageLeave
    ${If} $AhsoEnvState == "ready"
      ExecWait '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -STA -ExecutionPolicy Bypass -WindowStyle Hidden -File "$PLUGINSDIR\ahso-setup\windows\install.ps1" -Phase Database -InstallDir "$INSTDIR" -StateFile "$AhsoSetupStateFile" -LogFile "$AhsoSetupLogFile"' $0
      IntCmp $0 0 database_done
        MessageBox MB_ICONSTOP|MB_TOPMOST "Database setup was not completed.$\r$\nLog: $AhsoSetupLogFile"
        Abort
      database_done:
        Return
    ${EndIf}

    ${If} $AhsoEnvState == "missing"
      StrCpy $AhsoEnvMode "InstallRequirements"
      Call AhsoRunEnvironmentPhase
      Call AhsoRefreshEnvironmentReview
      ${If} $AhsoEnvState == "ready"
        Abort
      ${EndIf}
    ${EndIf}

    MessageBox MB_ICONEXCLAMATION|MB_OK "Environment setup did not finish successfully.$\r$\n$\r$\n$AhsoEnvMessage$\r$\n$\r$\nLog: $AhsoSetupLogFile"
    Abort
  FunctionEnd

  Function AhsoRefreshEnvironmentReview
    ${NSD_SetText} $AhsoEnvStatusBox "Node.js: $AhsoEnvNode$\r$\nnpm: $AhsoEnvNpm$\r$\nPostgreSQL: $AhsoEnvPostgresql$\r$\npgAdmin: $AhsoEnvPgAdmin"

    ${If} $AhsoEnvState == "ready"
      ${NSD_SetText} $AhsoEnvTitleLabel "All required frameworks are ready."
      ${NSD_SetText} $AhsoEnvBodyBox "This PC has all runtime frameworks needed by QR Recorder Server. Click Next to continue to database setup."
      ${NSD_SetText} $AhsoEnvActionLabel "Changed the environment? Click Check again."
      Return
    ${EndIf}

    ${If} $AhsoEnvState == "missing"
      ${NSD_SetText} $AhsoEnvTitleLabel "Missing runtime frameworks found."
      ${NSD_SetText} $AhsoEnvBodyBox "Missing: $AhsoEnvMissingList$\r$\nInstall them manually and click Check again, or click Next to let setup install them automatically."
      ${NSD_SetText} $AhsoEnvActionLabel "Manual install done? Check again."
      Return
    ${EndIf}

    ${NSD_SetText} $AhsoEnvTitleLabel "Environment check needs attention."
    ${NSD_SetText} $AhsoEnvBodyBox "$AhsoEnvMessage"
    ${NSD_SetText} $AhsoEnvActionLabel "Check the setup log, then try again."
  FunctionEnd

  Function AhsoEnvironmentRecheckClicked
    StrCpy $AhsoEnvMode "Scan"
    Call AhsoRunEnvironmentPhase
    Call AhsoRefreshEnvironmentReview
  FunctionEnd
!macroend

!macro cleanupIncompleteInstall
  DetailPrint "Removing incomplete QR Recorder installation traces..."
  Delete "$DESKTOP\QR Recorder Server.lnk"
  Delete "$SMPROGRAMS\QR Recorder Server.lnk"
  Delete "$SMPROGRAMS\QR Recorder Server\QR Recorder Server.lnk"
  Delete "$QUICKLAUNCH\QR Recorder Server.lnk"
  RMDir /r "$SMPROGRAMS\QR Recorder Server"
  Delete "$DESKTOP\Samsung QR Recorder Server.lnk"
  Delete "$SMPROGRAMS\Samsung QR Recorder Server.lnk"
  Delete "$SMPROGRAMS\Samsung QR Recorder Server\Samsung QR Recorder Server.lnk"
  Delete "$QUICKLAUNCH\Samsung QR Recorder Server.lnk"
  RMDir /r "$SMPROGRAMS\Samsung QR Recorder Server"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\vn.ahso.samsung.qrrecorder.server"
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\vn.ahso.samsung.qrrecorder.server"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\QR Recorder Server"
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\QR Recorder Server"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Samsung QR Recorder Server"
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Samsung QR Recorder Server"
  RMDir /r "$INSTDIR"
!macroend

!macro customInstall
  DetailPrint "Finalizing QR Recorder setup..."
  ExecWait '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -STA -ExecutionPolicy Bypass -WindowStyle Hidden -File "$INSTDIR\resources\setup\windows\install.ps1" -Phase Finalize -InstallDir "$INSTDIR" -StateFile "$AhsoSetupStateFile" -LogFile "$AhsoSetupLogFile"' $0
  IntCmp $0 0 setup_done
    ExecWait '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -STA -ExecutionPolicy Bypass -WindowStyle Hidden -File "$INSTDIR\resources\setup\windows\install.ps1" -Phase Rollback -InstallDir "$INSTDIR" -StateFile "$AhsoSetupStateFile" -LogFile "$AhsoSetupLogFile"'
    !insertmacro cleanupIncompleteInstall
    MessageBox MB_ICONSTOP|MB_TOPMOST "QR Recorder setup assistant failed.$\r$\nLog: $AhsoSetupLogFile"
    Abort "QR Recorder setup assistant failed."
  setup_done:
    Delete "$AhsoSetupStateFile"
!macroend
!else
!include nsDialogs.nsh
!include LogicLib.nsh

!macro customUnInit
  InitPluginsDir
  ExecWait '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -STA -ExecutionPolicy Bypass -WindowStyle Hidden -File "$INSTDIR\resources\setup\windows\uninstall.ps1" -InstallDir "$INSTDIR" -SelectOnly -ModeFile "$PLUGINSDIR\ahso-uninstall-mode.txt"' $0
  IntCmp $0 0 uninstall_choice_done
    Abort "Uninstall was cancelled."
  uninstall_choice_done:
!macroend

!macro customUnInstall
  DetailPrint "Running QR Recorder uninstall assistant..."
  ExecWait '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -STA -ExecutionPolicy Bypass -WindowStyle Hidden -File "$INSTDIR\resources\setup\windows\uninstall.ps1" -InstallDir "$INSTDIR" -ModeFile "$PLUGINSDIR\ahso-uninstall-mode.txt"'
!macroend
!endif
