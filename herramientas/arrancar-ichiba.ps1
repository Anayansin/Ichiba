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

function Esperar-Puerto([int]$puerto, [int]$segundos = 90) {
  for ($intento = 0; $intento -lt ($segundos * 2); $intento++) {
    if (Esta-Escuchando $puerto) { return $true }
    Start-Sleep -Milliseconds 500
  }
  return $false
}

& (Join-Path $PSScriptRoot "arrancar-bases.ps1")

if (Esta-Escuchando 5000) {
  Write-Host "Backend ya corriendo en http://localhost:5000"
} else {
  Start-Process -FilePath "powershell.exe" `
    -ArgumentList @(
      "-NoExit",
      "-Command",
      "Set-Location '$backend'; npm run dev"
    )
  if (Esperar-Puerto 5000) {
    Write-Host "Backend arrancando en http://localhost:5000 (ventana nueva)"
  } else {
    Write-Warning "El backend no respondio en 90 segundos. Revisa la ventana nueva y el archivo backend\.env."
  }
}

if (Esta-Escuchando 5173) {
  Write-Host "Frontend ya corriendo en http://localhost:5173"
} else {
  Start-Process -FilePath "powershell.exe" `
    -ArgumentList @(
      "-NoExit",
      "-Command",
      "Set-Location '$frontend'; npm run dev"
    )
  if (Esperar-Puerto 5173) {
    Write-Host "Frontend arrancando en http://localhost:5173 (ventana nueva)"
  } else {
    Write-Warning "El frontend no respondio en 90 segundos. Revisa la ventana nueva."
  }
}

if (Esta-Escuchando 5000) {
  try {
    $salud = Invoke-RestMethod -Uri "http://localhost:5000/api/salud" -TimeoutSec 10
    Write-Host "API local: $($salud.estado)"
  } catch {
    Write-Warning "La API responde en el puerto 5000 pero /api/salud fallo."
  }

  try {
    $cuerpo = @{ correo = "admin@ichiba.test"; password = "IchibaAdmin123!" } | ConvertTo-Json
    $login = Invoke-RestMethod -Method Post `
      -Uri "http://localhost:5000/api/usuarios/login" `
      -ContentType "application/json" -Body $cuerpo -TimeoutSec 15
    if ($login.usuario.tipo -eq "admin") {
      Write-Host "Acceso de administrador verificado (admin@ichiba.test)."
    } else {
      Write-Warning "La cuenta admin@ichiba.test existe pero no tiene el tipo admin."
    }
  } catch {
    Write-Warning "No se pudo entrar con admin@ichiba.test. Crea o promueve la cuenta con:"
    Write-Host "  cd backend"
    Write-Host "  npm run admin -- admin@ichiba.test IchibaAdmin123!"
  }
}

if (Esta-Escuchando 5173) {
  Start-Process "http://localhost:5173/inicio"
}

Write-Host ""
Write-Host "Ichiba listo: http://localhost:5173/inicio"
Write-Host "Panel de administrador: http://localhost:5173/admin"
Write-Host "Cuentas de prueba:"
Write-Host "  admin:    admin@ichiba.test / IchibaAdmin123!"
Write-Host "  vendedor: vendedor.demo@ichiba.test / IchibaDemo123!"
