export function generarCodigo(): string {
  // RQNF1.3: el código de confirmación del registro es numérico de 4 dígitos.
  return Math.floor(1000 + Math.random() * 9000).toString();
}
