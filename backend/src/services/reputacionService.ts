import { Venta } from "../models/Venta.js";

export type ReputacionVendedor = {
  promedio: number | null;
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
