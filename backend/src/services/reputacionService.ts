import { Venta } from "../models/Venta.js";

/**
 * Reputación del vendedor: promedio de las calificaciones que los compradores
 * le dieron a sus transacciones completadas.
 *
 * Las calificaciones viven en el espejo de MongoDB (`Venta.calificacionComprador`)
 * porque el contrato de PostgreSQL no las guarda; la fuente sigue siendo la
 * venta `completada` del escrow.
 */
export type ReputacionVendedor = {
  /** Promedio de 1 a 5 con un decimal, o null si aún no tiene calificaciones. */
  promedio: number | null;
  /** Cuántas calificaciones de compradores recibió. */
  totalCalificaciones: number;
};

export async function calcularReputacionVendedor(
  vendedorId: number,
): Promise<ReputacionVendedor> {
  try {
    const ventas = await Venta.find({
      vendedorId: String(vendedorId),
      estado: "completada",
      calificacionComprador: { $gte: 1, $lte: 5 },
    })
      .select("calificacionComprador")
      .lean();

    const calificaciones = ventas
      .map((venta) => Number(venta.calificacionComprador))
      .filter((valor) => Number.isFinite(valor));

    if (calificaciones.length === 0) {
      return { promedio: null, totalCalificaciones: 0 };
    }

    const suma = calificaciones.reduce((total, valor) => total + valor, 0);
    const promedio = Math.round((suma / calificaciones.length) * 10) / 10;

    return { promedio, totalCalificaciones: calificaciones.length };
  } catch (error) {
    console.error(
      "[reputacion] No se pudo calcular la reputación del vendedor:",
      (error as { message?: string })?.message ?? error,
    );
    return { promedio: null, totalCalificaciones: 0 };
  }
}
