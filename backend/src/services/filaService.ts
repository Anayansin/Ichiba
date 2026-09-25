import { Cola } from "../models/Cola.js";
import { Producto, TIEMPO_PAGO_DEFECTO } from "../models/producto.js";

export type Fila = InstanceType<typeof Cola>;

export function limitarTiempoPago(minutos: number): number {
  if (!Number.isFinite(minutos)) return TIEMPO_PAGO_DEFECTO;
  return Math.min(180, Math.max(30, Math.round(minutos)));
}

export async function obtenerTiempoLimitePago(
  productoId: string,
): Promise<number> {
  const producto = await Producto.findById(productoId);
  return limitarTiempoPago(producto?.tiempoLimitePago ?? TIEMPO_PAGO_DEFECTO);
}

/**
 * Marca en la fila el momento en el que vence el tiempo de pago.
 * El tiempo empieza a contar una vez que el comprador alcanza la posición 1.
 */
export async function iniciarTemporizadorPago(fila: Fila): Promise<void> {
  const tiempoLimite = await obtenerTiempoLimitePago(
    fila.productoId.toString(),
  );
  fila.pagoExpiraEn = new Date(Date.now() + tiempoLimite * 60 * 1000);
}

/**
 * Finaliza las filas activas de un comprador cuyo producto ya fue borrado.
 * Sin esto, esas filas fantasma consumen el límite de 3 filas activas y,
 * al hacer populate en misFilas, el frontend recibe productoId null y se rompe.
 */
export async function limpiarFilasHuerfanas(
  compradorId: string,
): Promise<void> {
  const filas = await Cola.find({ compradorId, estado: "activa" }).select(
    "productoId",
  );
  if (filas.length === 0) return;

  const ids = Array.from(new Set(filas.map((fila) => fila.productoId.toString())));
  const existentes = await Producto.find({ _id: { $in: ids } }).select("_id");
  const validos = new Set(existentes.map((producto) => producto._id.toString()));

  const huerfanas = filas
    .filter((fila) => !validos.has(fila.productoId.toString()))
    .map((fila) => fila._id);
  if (huerfanas.length === 0) return;

  await Cola.updateMany(
    { _id: { $in: huerfanas } },
    { estado: "finalizada" },
  );
}

export async function reacomodarFila(
  productoId: string,
  posicionQueSeLibero: number,
) {
  const tiempoLimite = await obtenerTiempoLimitePago(productoId);

  const personasDetras = await Cola.find({
    productoId,
    estado: "activa",
    posicion: { $gt: posicionQueSeLibero },
  });

  for (const persona of personasDetras) {
    persona.posicion -= 1;

    if (persona.posicion === 1) {
      persona.pagoExpiraEn = new Date(Date.now() + tiempoLimite * 60 * 1000);
    }

    await persona.save();
  }
}

/**
 * Si el turno de la posición 1 ya venció, finaliza la fila y
 * reacomoda a las personas de atrás. Devuelve true si venció.
 */
export async function expirarTurnoSiVencido(fila: Fila): Promise<boolean> {
  if (!fila.pagoExpiraEn || fila.pagoExpiraEn.getTime() > Date.now()) {
    return false;
  }

  fila.estado = "finalizada";
  await fila.save();
  await reacomodarFila(fila.productoId.toString(), fila.posicion);
  return true;
}

/**
 * Finaliza todas las filas que estuvieron en posición 1 y no pagaron
 * dentro del tiempo límite, para que el siguiente pueda pagar.
 */
export async function expirarFilasVencidas(): Promise<number> {
  const vencidas = await Cola.find({
    estado: "activa",
    posicion: 1,
    pagoExpiraEn: { $lt: new Date() },
  });

  for (const fila of vencidas) {
    fila.estado = "finalizada";
    await fila.save();
    await reacomodarFila(fila.productoId.toString(), fila.posicion);
  }

  return vencidas.length;
}
