# Arranca las dos bases de datos locales de Ichiba sin necesidad de
# permisos de administrador: MongoDB (puerto 27017) y PostgreSQL (puerto 5432).
#
# Uso:  powershell -ExecutionPolicy Bypass -File herramientas\arrancar-bases.ps1
#
# Si ya están escuchando no hace nada, así que se puede ejecutar cuantas veces
# se quiera (también al iniciar sesión, desde la carpeta Inicio de Windows).

$ErrorActionPreference = "Stop"

$raizMongo = Join-Path $env:LOCALAPPDATA "Programs\mongodb"
$raizPostgres = Join-Path $env:LOCALAPPDATA "Programs\postgresql"
$rutaMongod = Join-Path $raizMongo "bin\mongod.exe"
$rutaPg = Join-Path $raizPostgres "bin\pg_ctl.exe"
$rutaInitdb = Join-Path $raizPostgres "bin\initdb.exe"
$rutaCreatedb = Join-Path $raizPostgres "bin\createdb.exe"

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

# ---------- MongoDB ----------
if (Esta-Escuchando 27017) {
  Write-Host "MongoDB ya estaba corriendo en el puerto 27017"
} elseif (Test-Path $rutaMongod) {
  $datos = Join-Path $raizMongo "data"
  $bitacoraDir = Join-Path $raizMongo "log"
  $bitacora = Join-Path $bitacoraDir "mongod.log"
  New-Item -ItemType Directory -Force -Path $datos, $bitacoraDir | Out-Null

  Start-Process -FilePath $rutaMongod `
    -ArgumentList @("--dbpath", $datos, "--bind_ip", "127.0.0.1", "--port", "27017", "--logpath", $bitacora, "--quiet") `
    -WindowStyle Hidden

  for ($intento = 0; $intento -lt 40; $intento++) {
    if (Esta-Escuchando 27017) { break }
    Start-Sleep -Milliseconds 500
  }
  if (Esta-Escuchando 27017) {
    Write-Host "MongoDB iniciado en el puerto 27017"
  } else {
    Write-Warning "MongoDB no respondio; revisa $bitacora"
  }
} else {
  Write-Warning "No se encontro mongod.exe en $rutaMongod"
}

# ---------- PostgreSQL ----------
if (Esta-Escuchando 5432) {
  Write-Host "PostgreSQL ya estaba corriendo en el puerto 5432"
} elseif (Test-Path $rutaPg) {
  $datos = Join-Path $raizPostgres "data"
  $bitacoraDir = Join-Path $raizPostgres "log"
  $bitacora = Join-Path $bitacoraDir "postgres.log"
  New-Item -ItemType Directory -Force -Path $bitacoraDir | Out-Null

  if (-not (Test-Path (Join-Path $datos "PG_VERSION"))) {
    Write-Host "Inicializando PostgreSQL por primera vez..."
    New-Item -ItemType Directory -Force -Path $datos | Out-Null
    $archivoClave = Join-Path $env:TEMP "ichiba-pg-password.txt"
    Set-Content -Path $archivoClave -Value "postgres" -NoNewline -Encoding ascii
    & $rutaInitdb -U postgres -E UTF8 --locale=C -A scram-sha-256 -D $datos --pwfile=$archivoClave | Out-Null
    Remove-Item $archivoClave -Force
  }

  & $rutaPg -D $datos -l $bitacora -o "-p 5432 -c listen_addresses=127.0.0.1" start | Out-Null

  for ($intento = 0; $intento -lt 40; $intento++) {
    if (Esta-Escuchando 5432) { break }
    Start-Sleep -Milliseconds 500
  }

  if (Esta-Escuchando 5432) {
    Write-Host "PostgreSQL iniciado en el puerto 5432"
    $env:PGPASSWORD = "postgres"
    $baseExiste = & (Join-Path $raizPostgres "bin\psql.exe") -U postgres -tAc "SELECT 1 FROM pg_database WHERE datname='mi_base_datos'" 2>$null
    if ("$baseExiste".Trim() -ne "1") {
      & $rutaCreatedb -U postgres mi_base_datos 2>&1 | Out-Null
      Write-Host "Base de datos 'mi_base_datos' creada"
    }
  } else {
    Write-Warning "PostgreSQL no respondio; revisa $bitacora"
  }
} else {
  Write-Warning "No se encontro pg_ctl.exe en $rutaPg"
}
