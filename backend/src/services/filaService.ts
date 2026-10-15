import { Producto, TIEMPO_PAGO_DEFECTO } from "../models/producto.js";
import clientePrisma from "../configuracion/prisma.js";
import { enviarCorreoTurnoDePago } from "./emailService.js";
import {
  estaAtendiendo,
  type BloqueHorario,
} from "../utils/validarHorario.js";

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
    where: { compradorId, estado: { in: ["activa", "esperando_apertura"] } },
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
      data: { estado: "finalizada", motivoCierre: "producto_eliminado" },
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
      data: { estado: "finalizada", motivoCierre: "turno_vencido" },
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
      data: { estado: "finalizada", motivoCierre: "turno_vencido" },
    });
    await reacomodarFila(String(fila.productoId), Number(fila.posicion));
    liberadas += 1;
  }

  return liberadas;
}

/**
 * RQNF23 / RQNF23.2 / RQNF24.2: la compra de un comprador se canceló o se
 * rechazó su comprobante: su fila se cierra ("pagada"/"reposo" ->
 * "finalizada") y las personas que esperaban la confirmación ("en espera")
 * vuelven a la fila con su turno reacomodado. El producto se pone de nuevo
 * a la venta y, si alguien queda en posición 1, arranca su temporizador y se
 * le avisa por correo.
 */
export async function reanudarFilaTrasCancelacion(
  productoId: string,
  compradorId: string,
): Promise<{ reanudados: number }> {
  await clientePrisma.cola.updateMany({
    where: { productoId, compradorId, estado: "pagada" },
    data: { estado: "finalizada", motivoCierre: "venta_cancelada" },
  });
  await clientePrisma.cola.updateMany({
    where: { productoId, compradorId, estado: "reposo" },
    data: { estado: "finalizada", motivoCierre: "venta_cancelada" },
  });

  const enEspera = await clientePrisma.cola.findMany({
    where: { productoId, estado: "esperando_confirmacion" },
  });
  enEspera.sort((a, b) => Number(a.posicion) - Number(b.posicion));

  const tiempoLimite = await obtenerTiempoLimitePago(productoId);
  const producto = await Producto.findById(productoId);

  for (let indice = 0; indice < enEspera.length; indice += 1) {
    const fila = enEspera[indice];
    const nuevaPosicion = indice + 1;

    await clientePrisma.cola.update({
      where: { id: Number(fila.id) },
      data: {
        estado: "activa",
        posicion: nuevaPosicion,
        pagoExpiraEn:
          nuevaPosicion === 1
            ? new Date(Date.now() + tiempoLimite * 60 * 1000)
            : null,
      },
    });

    if (nuevaPosicion === 1 && fila.correo) {
      try {
        await enviarCorreoTurnoDePago(
          fila.correo,
          producto?.nombre ?? "",
          tiempoLimite,
        );
      } catch (error) {
        console.error("Error real:", error);
      }
    }
  }

  // El producto vuelve al catálogo: la compra que lo retiraba ya no existe.
  if (producto) {
    await Producto.updateOne({ _id: productoId }, { activo: true });
  }

  return { reanudados: enEspera.length };
}

/**
 * RQNF15: horarios de atención del vendedor dueño de un producto. Devuelve []
 * cuando el vendedor no tiene horarios definidos (disponible siempre).
 */
export async function horariosDelVendedorDeProducto(
  productoId: string,
): Promise<BloqueHorario[]> {
  const producto = await Producto.findById(productoId);
  if (!producto) return [];
  const vendedor = await clientePrisma.usuario.findUnique({
    where: { id: Number(producto.vendedorId) },
  });
  return Array.isArray(vendedor?.horarios)
    ? (vendedor?.horarios as BloqueHorario[])
    : [];
}

/**
 * RQF18 / RQNF18: guarda el lugar del comprador en la fila y pausa su reloj
 * de pago hasta la próxima apertura del vendedor.
 */
export async function pausarHastaLaApertura(filaId: number): Promise<void> {
  await clientePrisma.cola.update({
    where: { id: filaId },
    data: { estado: "esperando_apertura", pagoExpiraEn: null },
  });
}

/**
 * RQF18: al abrir un bloque de atención del vendedor, las filas que esperaban
 * su próxima apertura se reanudan conservando su lugar (RQNF18); si la
 * primera posición vuelve a estar activa, arranca su temporizador de pago y
 * se le avisa por correo.
 */
export async function reactivarFilasEnEsperaDeApertura(): Promise<number> {
  const enEspera = await clientePrisma.cola.findMany({
    where: { estado: "esperando_apertura" },
    orderBy: { posicion: "asc" },
  });
  if (enEspera.length === 0) return 0;

  const ahora = new Date();
  const cache = new Map<
    string,
    { horarios: BloqueHorario[]; nombre: string }
  >();
  let reactivadas = 0;

  for (const fila of enEspera) {
    const productoId = String(fila.productoId);

    let datos = cache.get(productoId);
    if (!datos) {
      const producto = await Producto.findById(productoId);
      const vendedor = producto
        ? await clientePrisma.usuario.findUnique({
            where: { id: Number(producto.vendedorId) },
          })
        : null;
      datos = {
        horarios: Array.isArray(vendedor?.horarios)
          ? (vendedor?.horarios as BloqueHorario[])
          : [],
        nombre: producto?.nombre ?? "",
      };
      cache.set(productoId, datos);
    }

    if (!estaAtendiendo(datos.horarios, ahora)) continue;

    const esTurno = Number(fila.posicion) === 1;
    const tiempoLimite = esTurno
      ? await obtenerTiempoLimitePago(productoId)
      : 0;
    await clientePrisma.cola.update({
      where: { id: Number(fila.id) },
      data: {
        estado: "activa",
        pagoExpiraEn: esTurno
          ? new Date(Date.now() + tiempoLimite * 60000)
          : null,
      },
    });
    reactivadas += 1;

    if (esTurno && fila.correo) {
      try {
        await enviarCorreoTurnoDePago(fila.correo, datos.nombre, tiempoLimite);
      } catch (error) {
        console.error("Error real:", error);
      }
    }
  }

  return reactivadas;
}
