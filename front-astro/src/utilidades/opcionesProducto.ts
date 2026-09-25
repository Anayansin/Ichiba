export const CONDICIONES_PRODUCTO = [
  { valor: "nuevo", texto: "Nuevo" },
  { valor: "usado-como-nuevo", texto: "Usado - como nuevo" },
  { valor: "usado-buen-estado", texto: "Usado - buen estado" },
  { valor: "usado-aceptable", texto: "Usado - aceptable" },
];

export const METODOS_ENTREGA = [
  { valor: "domicilio", texto: "Domicilio" },
  { valor: "tienda", texto: "Tienda" },
  { valor: "punto-encuentro", texto: "Punto de encuentro" },
];

export const TIEMPOS_LIMITE_PAGO = [30, 60, 90, 120, 150, 180];

export function textoCondicion(valor?: string): string {
  return (
    CONDICIONES_PRODUCTO.find((c) => c.valor === valor)?.texto ||
    "No especificada"
  );
}

export function textoMetodoEntrega(valor?: string): string {
  return (
    METODOS_ENTREGA.find((m) => m.valor === valor)?.texto ||
    "No especificado"
  );
}

export function textoTiempoPago(minutos?: number): string {
  if (!minutos) return "No especificado";

  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;

  if (horas === 0) return `${resto} minutos`;

  const parteHoras = horas === 1 ? "1 hora" : `${horas} horas`;
  return resto > 0 ? `${parteHoras} ${resto} minutos` : parteHoras;
}
