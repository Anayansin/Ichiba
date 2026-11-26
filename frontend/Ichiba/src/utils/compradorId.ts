import { usuarioDeSesion } from "./sesion";

const LLAVE_ANONIMO = "compradorId";
const LLAVE_ANONIMO_ASIGNADO = "compradorIdAnonimoAsignado";

function nuevoId(): string {
  return crypto.randomUUID();
}

function idAnonimo(): string {
  let id = localStorage.getItem(LLAVE_ANONIMO);
  if (!id) {
    id = nuevoId();
    localStorage.setItem(LLAVE_ANONIMO, id);
  }
  return id;
}

// Identificador con el que la persona compra (filas, pedidos, chats).
// Cada cuenta tiene el suyo, para que dos cuentas abiertas en el mismo
// navegador no compartan filas ni compras. Sin sesión se usa el del
// navegador.
export function obtenerCompradorId(): string {
  const usuario = usuarioDeSesion();
  if (!usuario) return idAnonimo();

  const llave = `${LLAVE_ANONIMO}:${usuario.id}`;
  let id = localStorage.getItem(llave);
  if (!id) {
    // La primera cuenta que inicia sesión en este navegador conserva el
    // identificador que ya existía, junto con sus filas y compras.
    if (!localStorage.getItem(LLAVE_ANONIMO_ASIGNADO)) {
      id = idAnonimo();
      localStorage.setItem(LLAVE_ANONIMO_ASIGNADO, String(usuario.id));
    } else {
      id = nuevoId();
    }
    localStorage.setItem(llave, id);
  }
  return id;
}
