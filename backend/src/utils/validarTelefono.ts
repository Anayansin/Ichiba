export function validarTelefono(telefono: string): boolean {
  return /^\d{10}$/.test(telefono);
}
