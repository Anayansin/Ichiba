# Abre en Chrome, en una ventana nueva, la guía de revisión y todas las pestañas de revisión de requerimientos.
# Requiere el backend (puerto 5000) y el frontend (puerto 5173) corriendo, y haber generado
# revision/pestanas.txt con herramientas/generar-revision.cjs.
$raiz = Split-Path -Parent $PSScriptRoot
$lista = Join-Path $raiz "revision\pestanas.txt"
if (-not (Test-Path $lista)) {
  Write-Host "No existe revision\pestanas.txt. Ejecuta primero: node herramientas/generar-revision.cjs"
  exit 1
}
$chrome = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $chrome) {
  Write-Host "No se encontró Chrome."
  exit 1
}
$direcciones = Get-Content $lista | Where-Object { $_.Trim() -ne "" }
Start-Process -FilePath $chrome -ArgumentList (@("--new-window") + $direcciones)
Write-Host "Se abrieron $($direcciones.Count) pestañas en Chrome."
