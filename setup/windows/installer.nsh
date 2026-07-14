!macro customInstall
  DetailPrint "Running Samsung QR Recorder setup assistant..."
  ExecWait '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\resources\setup\windows\install.ps1" -InstallDir "$INSTDIR"' $0
  IntCmp $0 0 setup_done
    Abort "Samsung QR Recorder setup assistant failed."
  setup_done:
!macroend

!macro customUnInstall
  DetailPrint "Running Samsung QR Recorder uninstall assistant..."
  ExecWait '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\resources\setup\windows\uninstall.ps1" -InstallDir "$INSTDIR"'
!macroend
