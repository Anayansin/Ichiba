import type { Usuario } from "../services/authService";

// Cada pestaña guarda su propia sesión (sessionStorage), así se pueden usar
// cuentas distintas en pestañas distintas del mismo navegador sin que una
// pise a la otra. localStorage solo guarda la última sesión iniciada para
// que una pestaña nueva arranque con ella.
const LLAVE_TOKEN = "token";
const LLAVE_USUARIO = "usuario";
const LLAVE_SEMBRADA = "sesionSembrada";

function sembrarPestana() {
  try {
    if (sessionStorage.getItem(LLAVE_SEMBRADA)) return;
    sessionStorage.setItem(LLAVE_SEMBRADA, "1");
    const token = localStorage.getItem(LLAVE_TOKEN);
    const usuario = localStorage.getItem(LLAVE_USUARIO);
    if (token && usuario) {
      sessionStorage.setItem(LLAVE_TOKEN, token);
      sessionStorage.setItem(LLAVE_USUARIO, usuario);
    }
  } catch {
    // Sin almacenamiento disponible: la pestaña inicia sin sesión.
  }
}

sembrarPestana();

export function tokenDeSesion(): string | null {
  return sessionStorage.getItem(LLAVE_TOKEN);
}

export function usuarioDeSesion(): Usuario | null {
  try {
    const guardado = sessionStorage.getItem(LLAVE_USUARIO);
    return guardado ? (JSON.parse(guardado) as Usuario) : null;
  } catch {
    return null;
  }
}

export function guardarSesion(usuario: Usuario, token: string) {
  const texto = JSON.stringify(usuario);
  sessionStorage.setItem(LLAVE_TOKEN, token);
  sessionStorage.setItem(LLAVE_USUARIO, texto);
  localStorage.setItem(LLAVE_TOKEN, token);
  localStorage.setItem(LLAVE_USUARIO, texto);
}

export function borrarSesion() {
  const token = sessionStorage.getItem(LLAVE_TOKEN);
  sessionStorage.removeItem(LLAVE_TOKEN);
  sessionStorage.removeItem(LLAVE_USUARIO);
  // Solo se olvida la sesión del navegador si es la de esta pestaña.
  if (token && localStorage.getItem(LLAVE_TOKEN) === token) {
    localStorage.removeItem(LLAVE_TOKEN);
    localStorage.removeItem(LLAVE_USUARIO);
  }
}
