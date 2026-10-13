export function generarCodigo(): string {
  // RQNF1.3: el código de verificación tiene 6 dígitos.
  return Math.floor(100000 + Math.random() * 900000).toString();
}
