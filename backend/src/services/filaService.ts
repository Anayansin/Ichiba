import { Producto, TIEMPO_PAGO_DEFECTO } from "../models/producto.js";
import clientePrisma from "../configuracion/prisma.js";
import { enviarCorreoTurnoDePago } from "./emailService.js";

export type Fila = {
  id?: unknown;
  productoId: unknown;
  posicion: number;
  estado: string;
  pagoExpiraEn?: Date | null;
  save?: () => Promise<unknown>;
};

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
    String(fila.productoId),
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
  const filas = await clientePrisma.cola.findMany({
    where: { compradorId, estado: "activa" },
  });
  if (filas.length === 0) return;

  const ids = [
    ...new Set(
      filas
        .map((fila) => String(fila.productoId))
        .filter((id) => /^[0-9a-fA-F]{24}$/.test(id)),
    ),
  ];
  const existentes = ids.length
    ? await Producto.find({ _id: { $in: ids } }).select("_id")
    : [];
  const validos = new Set(existentes.map((producto) => String(producto._id)));

  for (const fila of filas) {
    if (validos.has(String(fila.productoId))) continue;
    await clientePrisma.cola.update({
      where: { id: Number(fila.id) },
      data: { estado: "finalizada" },
    });
  }
}

export async function reacomodarFila(
  productoId: string,
  posicionQueSeLibero: number,
) {
  const tiempoLimite = await obtenerTiempoLimitePago(productoId);

  const personasDetras = await clientePrisma.cola.findMany({
    where: { productoId, estado: "activa" },
  });

  for (const persona of personasDetras) {
    const posicion = Number(persona.posicion);
    if (posicion <= posicionQueSeLibero) continue;

    const nuevaPosicion = posicion - 1;
    const datos: Record<string, unknown> = { posicion: nuevaPosicion };

    if (nuevaPosicion === 1) {
      datos.pagoExpiraEn = new Date(Date.now() + tiempoLimite * 60 * 1000);
    }

    await clientePrisma.cola.update({
      where: { id: Number(persona.id) },
      data: datos,
    });

    if (nuevaPosicion === 1 && persona.correo) {
      try {
        const producto = await Producto.findById(productoId);
        await enviarCorreoTurnoDePago(
          persona.correo,
          producto?.nombre ?? "",
          tiempoLimite,
        );
      } catch (error) {
        console.error("Error real:", error);
      }
    }
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
  if (fila.save) {
    await fila.save();
  } else {
    await clientePrisma.cola.update({
      where: { id: Number(fila.id) },
      data: { estado: "finalizada" },
    });
  }
  await reacomodarFila(String(fila.productoId), fila.posicion);
  return true;
}

/**
 * Finaliza todas las filas que estuvieron en posición 1 y no pagaron
 * dentro del tiempo límite, para que el siguiente pueda pagar.
 */
export async function expirarFilasVencidas(): Promise<number> {
  const enPrimeraPosicion = await clientePrisma.cola.findMany({
    where: { estado: "activa", posicion: 1 },
  });

  let liberadas = 0;
  for (const fila of enPrimeraPosicion) {
    if (!fila.pagoExpiraEn || fila.pagoExpiraEn.getTime() > Date.now()) continue;

    await clientePrisma.cola.update({
      where: { id: Number(fila.id) },
      data: { estado: "finalizada" },
    });
    await reacomodarFila(String(fila.productoId), Number(fila.posicion));
    liberadas += 1;
  }

  return liberadas;
}
