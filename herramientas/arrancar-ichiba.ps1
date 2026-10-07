# Arranca ICHIBA completo sin permisos de administrador:
#   1) MongoDB (27017) y PostgreSQL (5432)   -> herramientas\arrancar-bases.ps1
#   2) Backend  (http://localhost:5000)
#   3) Frontend (http://localhost:5173)
#
# Uso:  powershell -ExecutionPolicy Bypass -File herramientas\arrancar-ichiba.ps1
#
# Es idempotente: si algo ya está corriendo no lo arranca otra vez, así que se
# puede ejecutar cuantas veces se quiera.

$ErrorActionPreference = "Stop"

$raiz = Split-Path -Parent $PSScriptRoot
$backend = Join-Path $raiz "backend"
$frontend = Join-Path $raiz "frontend\Ichiba"

function Esta-Escuchando([int]$puerto) {
  try {
    $conexion = New-Object System.Net.Sockets.TcpClient
    $conexion.Connect("127.0.0.1", $puerto)
    $conexion.Close()
    return $true
  } catch {
    return $false
  }
}

# ---------- 1. Bases de datos ----------
& (Join-Path $PSScriptRoot "arrancar-bases.ps1")

# ---------- 2. Backend ----------
if (Esta-Escuchando 5000) {
  Write-Host "Backend ya corriendo en http://localhost:5000"
} else {
  Start-Process -FilePath "powershell.exe" `
    -ArgumentList @(
      "-NoExit",
      "-Command",
      "Set-Location '$backend'; npm run dev"
    )
  Write-Host "Backend arrancando en http://localhost:5000 (ventana nueva)"
}

# ---------- 3. Frontend ----------
if (Esta-Escuchando 5173) {
  Write-Host "Frontend ya corriendo en http://localhost:5173"
} else {
  Start-Process -FilePath "powershell.exe" `
    -ArgumentList @(
      "-NoExit",
      "-Command",
      "Set-Location '$frontend'; npm run dev"
    )
  Write-Host "Frontend arrancando en http://localhost:5173 (ventana nueva)"
}

Write-Host ""
Write-Host "Ichiba listo: abre http://localhost:5173 en tu navegador."
Write-Host "Cuentas de prueba:"
Write-Host "  admin:       admin@ichiba.test / IchibaAdmin123!"
Write-Host "  vendedor:    vendedor.demo@ichiba.test / IchibaDemo123!"
