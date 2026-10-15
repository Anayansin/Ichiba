import fs from "fs";
import path from "path";
import clientePrisma from "../configuracion/prisma.js";
import { Producto } from "../models/producto.js";
import { Promocional } from "../models/Promocional.js";
import { Mensaje } from "../models/Mensaje.js";
import { Usuario } from "../models/usuario.js";
import { Venta } from "../models/Venta.js";
import {
  VinculoPayPal,
  EstadoVinculacionPayPal,
} from "../models/VinculoPayPal.js";
import { agregarAListaNegra } from "./listaNegraService.js";
import { puntosDeCategoria } from "../configuracion/categoriasReporte.js";
import {
  publicarEventoUsuario,
  publicarListaNegraActualizada,
  publicarResumenAdmin,
} from "../graphql/suscripciones.js";
import { resumirUsuario } from "./resumenAdminService.js";
import {
  enviarCorreoCuentaCancelada,
  enviarCorreoProductoNoDisponible,
} from "./emailService.js";

/**
 * RQNF10.1 / RQNF10.3 / RQNF10.5 / RQNF10.6 / RQNF10.7 / RQF11 / RQF12:
 * cancelación definitiva de la cuenta de un vendedor al acumular 8 puntos de
 * reputación por infracción.
 *
 * Secuencia aprobada por el cliente (la única que permite cumplir a la vez
 * RQNF10.6 y RQF12):
 *
 *   1. Al llegar a 8 puntos (el administrador confirma un reporte):
 *      - la cuenta pasa a `cancelada`;
 *      - se envía el correo de cancelación permanente con el motivo y los
 *        reportes que la originaron (RQF11 / RQNF10.5);
 *      - se agrega de inmediato a la lista negra el RFC y los datos de la
 *        identificación oficial (RQNF10.6), para que no pueda re-registrarse;
 *      - se desactivan sus publicaciones (productos y promocionales) y se
 *        cancelan las filas virtuales en las que el cliente aún no pagó,
 *        avisándole que el producto ya no está disponible (RQNF10.7);
 *      - el vendedor solo conserva acceso a las entregas con pago confirmado
 *        (RQF12); se mantienen su correo y contraseña mientras existan para
 *        que pueda ingresar a completarlas.
 *
 *   2. Cuando ya no quedan entregas pendientes, se purga de forma permanente
 *      toda su información: nombre, domicilio, teléfono, correo, contraseña,
 *      publicaciones, historial de chats y token de acceso de PayPal
 *      (RQNF10.6). Lo revisa el trabajo `revisionEntregas` y también se
 *      dispara al completarse o cancelarse la última entrega.
 */

/** RQNF10.3: puntos acumulados que cancelan la cuenta de forma permanente. */
export const PUNTOS_CANCELACION = 8;

/** Estados de venta que cuentan como entrega pendiente (pago ya confirmado). */
export const ESTADOS_ENTREGA_PENDIENTE = [
  "pendiente_comprobante",
  "pendiente_confirmacion",
  "en_entrega",
] as const;

export type ResultadoCancelacion = {
  cuentaCancelada: boolean;
  yaCancelada: boolean;
  correoEnviado: boolean;
  filasCanceladas: number;
  purgada: boolean;
  error?: string;
};

function esVendedorCancelado(usuario: {
  estadoCuenta?: string | null;
} | null): boolean {
  return usuario?.estadoCuenta === "cancelada";
}

/** ¿El vendedor tiene transacciones con pago confirmado sin resolver? */
export async function hayEntregasPendientes(
  vendedorId: number,
): Promise<boolean> {
  const ventas = await clientePrisma.venta.findMany({
    where: { vendedorId },
  });
  return ventas.some((venta) =>
    (ESTADOS_ENTREGA_PENDIENTE as readonly string[]).includes(
      String(venta.estado),
    ),
  );
}

async function notificarProductoNoDisponible(
  correo: string | null | undefined,
  nombreProducto: string,
) {
  if (!correo) return;
  try {
    await enviarCorreoProductoNoDisponible(correo, nombreProducto);
  } catch (error) {
    console.error(
      "[cancelacion] No se pudo avisar al cliente retirado de la fila:",
      error instanceof Error ? error.message : error,
    );
  }
}

/**
 * RQNF10.7: cancela las filas virtuales del vendedor en las que el cliente
 * aún no pagó (activa / esperando confirmación) y notifica a cada cliente.
 */
export async function cancelarFilasSinPagoDelVendedor(
  vendedorId: number,
): Promise<number> {
  const productos = await Producto.find({ vendedorId: String(vendedorId) })
    .select("_id nombre")
    .lean();
  if (productos.length === 0) return 0;

  const nombrePorProducto = new Map(
    productos.map((producto) => [String(producto._id), producto.nombre]),
  );
  const ids = [...nombrePorProducto.keys()];

  const colas = await clientePrisma.cola.findMany({ where: {} });
  let canceladas = 0;

  for (const fila of colas) {
    const productoId = String(fila.productoId);
    if (!ids.includes(productoId)) continue;
    if (fila.estado !== "activa" && fila.estado !== "esperando_confirmacion") {
      continue;
    }

    await clientePrisma.cola.update({
      where: { id: Number(fila.id) },
      data: { estado: "cancelada", motivoCierre: "cuenta_cancelada" },
    });
    canceladas += 1;

    await notificarProductoNoDisponible(
      fila.correo,
      nombrePorProducto.get(productoId) ?? "",
    );
  }

  return canceladas;
}

/**
 * RQF11 / RQNF10.5: reportes confirmados que originaron la cancelación,
 * con los puntos que aportó cada uno.
 */
async function reportesQueOriginaronLaCancelacion(vendedorId: number) {
  const reportes = await clientePrisma.reporte.findMany({
    where: { vendedorId },
    orderBy: { createdAt: "asc" },
  });

  return reportes
    .filter((reporte) => reporte.estado === "confirmado")
    .map((reporte) => ({
      categoriaNombre: reporte.categoriaNombre,
      tipoFalta: reporte.tipoFalta,
      puntos: puntosDeCategoria(reporte.categoria, reporte.tipoFalta),
      fecha: reporte.createdAt ?? null,
    }));
}

export type ResultadoPuntos = {
  /** Puntos que aportó el reporte confirmado (RQNF10.1). */
  puntos: number;
  /** Puntos acumulados del vendedor tras sumar el reporte. */
  puntosReputacion: number;
  /** Presente cuando la cuenta alcanzó (o ya tenía) los 8 puntos. */
  cancelacion: ResultadoCancelacion | null;
};

/**
 * RQNF10.1 / RQNF10.3: suma los puntos del reporte confirmado por el
 * administrador a la reputación del vendedor y, cuando llega a 8 puntos,
 * cancela su cuenta de forma permanente. La usan los dos endpoints de
 * confirmación de reportes (`resolverReporte` y `confirmarReporte`).
 */
export async function acumularPuntosDeReporte(
  vendedorId: number,
  categoria: string,
  tipoFalta?: string | null,
): Promise<ResultadoPuntos> {
  const puntos = puntosDeCategoria(categoria, tipoFalta);

  if (puntos > 0) {
    await clientePrisma.usuario.update({
      where: { id: vendedorId },
      data: { puntosReputacion: { increment: puntos } },
    });
  }

  const vendedor = await clientePrisma.usuario.findUnique({
    where: { id: vendedorId },
  });
  const puntosReputacion = Number(vendedor?.puntosReputacion ?? 0);

  // Espejo en MongoDB (panel de administración): mantiene los puntos
  // aunque la cuenta todavía no se cancele.
  await Usuario.updateOne(
    { usuarioId: vendedorId },
    { $set: { puntosReputacion } },
  ).catch((errorMongo) => {
    console.error(
      "[cancelacion] No se pudieron reflejar los puntos en el espejo:",
      errorMongo?.message ?? errorMongo,
    );
  });

  let cancelacion: ResultadoCancelacion | null = null;
  if (vendedor && puntosReputacion >= PUNTOS_CANCELACION) {
    cancelacion = await cancelarCuentaPorPuntos(vendedorId);
  }

  // Fase 4: el BackOffice (gestión de usuarios y dashboard) se entera al
  // instante de los puntos nuevos o de la cancelación permanente.
  await publicarCambioDeReputacion(
    vendedorId,
    puntosReputacion,
    cancelacion,
    vendedor,
  );
  publicarResumenAdmin();

  return { puntos, puntosReputacion, cancelacion };
}

/**
 * Fase 4: publica el cambio de reputación de un vendedor en la suscripción
 * `usuariosAdmin`. Usa el espejo de MongoDB (la fuente del panel) y cae a los
 * datos de PostgreSQL si el espejo no existe.
 */
async function publicarCambioDeReputacion(
  vendedorId: number,
  puntosReputacion: number,
  cancelacion: ResultadoCancelacion | null,
  vendedor: {
    nombreCompleto?: string | null;
    correo?: string | null;
    tipo?: string | null;
    estadoCuenta?: string | null;
    createdAt?: Date | null;
  } | null,
) {
  try {
    const espejo = await Usuario.findOne({ usuarioId: vendedorId }).lean();
    const resumen = espejo
      ? resumirUsuario(espejo)
      : {
          id: String(vendedorId),
          nombreCompleto: String(vendedor?.nombreCompleto ?? ""),
          correo: String(vendedor?.correo ?? ""),
          tipo: String(vendedor?.tipo ?? "vendedor"),
          suspendido: false,
          puntosReputacion,
          estadoCuenta: cancelacion
            ? "cancelada"
            : String(vendedor?.estadoCuenta ?? "activa"),
          fechaRegistro: vendedor?.createdAt ? new Date(vendedor.createdAt) : null,
          motivoSuspension: null,
          saldoPendiente: 0,
          sancionHasta: null,
          sancionPermanente: false,
          revisionAdministrativa: false,
        };

    const nombre = resumen.nombreCompleto || `#${vendedorId}`;
    await publicarEventoUsuario(
      cancelacion ? "cancelada" : "puntos",
      cancelacion
        ? `La cuenta de ${nombre} fue cancelada de forma permanente (${puntosReputacion} puntos)`
        : `${nombre} acumula ${puntosReputacion}/${PUNTOS_CANCELACION} puntos de cancelación`,
      resumen,
    );
  } catch (error) {
    console.error(
      "[cancelacion] No se pudo publicar el cambio de reputación:",
      error instanceof Error ? error.message : error,
    );
  }
}

/**
 * RQNF10.3 / RQNF10.5 / RQNF10.6 / RQNF10.7: cancela la cuenta del vendedor
 * (idempotente) al alcanzar los 8 puntos de reputación.
 */
export async function cancelarCuentaPorPuntos(
  vendedorId: number,
): Promise<ResultadoCancelacion> {
  const vendedor = await clientePrisma.usuario.findUnique({
    where: { id: vendedorId },
  });

  if (!vendedor) {
    return {
      cuentaCancelada: false,
      yaCancelada: false,
      correoEnviado: false,
      filasCanceladas: 0,
      purgada: false,
      error: "Vendedor no encontrado",
    };
  }

  if (esVendedorCancelado(vendedor)) {
    return {
      cuentaCancelada: false,
      yaCancelada: true,
      correoEnviado: false,
      filasCanceladas: 0,
      purgada: Boolean(vendedor.datosEliminadosEn),
    };
  }

  const ahora = new Date();

  // 1. La cuenta queda cancelada (RQF12: acceso restringido a entregas).
  await clientePrisma.usuario.update({
    where: { id: vendedorId },
    data: {
      estadoCuenta: "cancelada",
      canceladaEn: ahora,
    },
  });

  // Espejo en MongoDB (panel de administración).
  await Usuario.updateOne(
    { usuarioId: vendedorId },
    {
      $set: {
        estadoCuenta: "cancelada",
        canceladaEn: ahora,
        puntosReputacion: Number(vendedor.puntosReputacion ?? 0),
      },
    },
  ).catch((errorMongo) => {
    console.error(
      "[cancelacion] No se pudo actualizar el espejo del usuario:",
      errorMongo?.message ?? errorMongo,
    );
  });

  // 2. Correo de cancelación permanente (RQF11 / RQNF10.5).
  let correoEnviado = false;
  try {
    const reportes = await reportesQueOriginaronLaCancelacion(vendedorId);
    correoEnviado = await enviarCorreoCuentaCancelada(
      String(vendedor.correo),
      String(vendedor.nombreCompleto ?? ""),
      Number(vendedor.puntosReputacion ?? 0),
      reportes,
    );
  } catch (error) {
    console.error(
      "[cancelacion] No se pudo enviar el correo de cancelación:",
      error instanceof Error ? error.message : error,
    );
  }

  // 3. Lista negra inmediata: RFC y datos de la identificación oficial
  //    (RQNF10.6). No se conserva nombre ni correo.
  try {
    await agregarAListaNegra({
      rfc: vendedor.rfc,
      curp: vendedor.curp,
      ineCodigoReverso: vendedor.ineCodigoReverso,
      motivo: `Cuenta cancelada de forma permanente por acumular ${PUNTOS_CANCELACION} puntos de reputación por infracción (RQNF10.3)`,
      origen: "cuenta-eliminada",
    });
  } catch (error: unknown) {
    const duplicado =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: number }).code === 11000;
    if (!duplicado) {
      console.error(
        "[cancelacion] No se pudo agregar a la lista negra:",
        error,
      );
    }
  }

  // Fase 4: la lista negra del BackOffice se actualiza al instante.
  await publicarListaNegraActualizada(
    "agregada",
    "La cuenta cancelada se agregó a la lista negra",
  );

  // 4. Publicaciones fuera del catálogo: ya no recibe clientes (RQF12).
  await Producto.updateMany(
    { vendedorId: String(vendedorId) },
    { activo: false },
  );
  await Promocional.updateMany(
    { vendedorId: String(vendedorId) },
    { activo: false },
  );

  // 5. Filas sin pago canceladas y clientes notificados (RQNF10.7).
  let filasCanceladas = 0;
  try {
    filasCanceladas = await cancelarFilasSinPagoDelVendedor(vendedorId);
  } catch (error) {
    console.error(
      "[cancelacion] No se pudieron cancelar las filas del vendedor:",
      error instanceof Error ? error.message : error,
    );
  }

  // 6. Si ya no hay entregas pendientes, se purga de inmediato (RQNF10.6).
  const purgada = await purgarCuentaSiCorresponde(vendedorId);

  return {
    cuentaCancelada: true,
    yaCancelada: false,
    correoEnviado,
    filasCanceladas,
    purgada,
  };
}

/** Borra los archivos de la INE del disco (mejor esfuerzo). */
function borrarArchivosIne(...rutas: (string | null | undefined)[]) {
  for (const ruta of rutas) {
    if (!ruta) continue;
    try {
      const absoluta = path.resolve(process.cwd(), ruta.replace(/^\/+/, ""));
      fs.unlink(absoluta, () => {});
    } catch {
      // El archivo pudo no existir: la purga de datos no depende de él.
    }
  }
}

/**
 * RQNF10.6: elimina de forma permanente e irrecuperable toda la información
 * personal y de la plataforma del vendedor cancelado (nombre, domicilio,
 * teléfono, correo, contraseña, publicaciones, historial de chats y token de
 * acceso de PayPal). La fila de PostgreSQL se conserva anonimizada porque las
 * ventas y los reportes la referencian; el RFC y los datos de la INE ya viven
 * solo en la lista negra.
 */
export async function purgarCuentaCancelada(
  vendedorId: number,
): Promise<boolean> {
  const vendedor = await clientePrisma.usuario.findUnique({
    where: { id: vendedorId },
  });

  if (!vendedor || !esVendedorCancelado(vendedor) || vendedor.datosEliminadosEn) {
    return false;
  }

  const vendedorEnTexto = String(vendedorId);

  // Acceso: el espejo de MongoDB es la fuente del inicio de sesión.
  await Usuario.deleteOne({ usuarioId: vendedorId }).catch((errorMongo) => {
    console.error(
      "[cancelacion] No se pudo eliminar el espejo del usuario:",
      errorMongo?.message ?? errorMongo,
    );
  });

  // Publicaciones: productos y promocionales.
  await Producto.deleteMany({ vendedorId: vendedorEnTexto });
  await Promocional.deleteMany({ vendedorId: vendedorEnTexto });

  // Historial de chats: mensajes de todas sus ventas.
  try {
    const ventasEnMongo = await Venta.find({ vendedorId: vendedorEnTexto })
      .select("_id")
      .lean();
    const idsVentas = ventasEnMongo.map((venta) => venta._id);
    if (idsVentas.length > 0) {
      await Mensaje.deleteMany({ ventaId: { $in: idsVentas } });
    }
  } catch (error) {
    console.error(
      "[cancelacion] No se pudo eliminar el historial de chats:",
      error instanceof Error ? error.message : error,
    );
  }

  // Token de acceso de PayPal (y estados de vinculación pendientes).
  await VinculoPayPal.deleteOne({ usuarioId: vendedorId }).catch(() => {});
  await EstadoVinculacionPayPal.deleteMany({ usuarioId: vendedorId }).catch(
    () => {},
  );

  // Archivos de la identificación oficial.
  borrarArchivosIne(vendedor.ineFrente, vendedor.ineReverso);

  // Anonimización de la fila en PostgreSQL (se conserva por integridad).
  await clientePrisma.usuario.update({
    where: { id: vendedorId },
    data: {
      nombreCompleto: "Cuenta cancelada",
      direccion: "",
      telefono: "",
      correo: `cuenta-cancelada-${vendedorId}@ichiba.invalid`,
      rfc: "ELIMINADO",
      password: `eliminado-${vendedorId}-${Date.now()}`,
      curp: null,
      ineCodigoReverso: null,
      ineFrente: "",
      ineReverso: "",
      paypalEmail: "",
      horarios: [],
      horarioConfirmadoEn: null,
      datosEliminadosEn: new Date(),
    },
  });

  console.log(
    `[cancelacion] Cuenta ${vendedorId} purgada: datos personales eliminados y RFC/INE conservados en la lista negra`,
  );

  // Fase 4: el BackOffice refresca la gestión de usuarios (la cuenta purgada
  // desaparece del espejo) y el dashboard.
  await publicarEventoUsuario(
    "purgada",
    `Se purgó por completo la cuenta cancelada #${vendedorId}`,
    null,
  );
  publicarResumenAdmin();

  return true;
}

/**
 * Purga la cuenta solo si está cancelada, aún no se purgó y ya no tiene
 * entregas con pago confirmado sin resolver (RQNF10.6 + RQF12).
 */
export async function purgarCuentaSiCorresponde(
  vendedorId: number,
): Promise<boolean> {
  const vendedor = await clientePrisma.usuario.findUnique({
    where: { id: vendedorId },
  });

  if (!vendedor || !esVendedorCancelado(vendedor) || vendedor.datosEliminadosEn) {
    return false;
  }

  if (await hayEntregasPendientes(vendedorId)) return false;

  return purgarCuentaCancelada(vendedorId);
}

/**
 * Revisa todas las cuentas canceladas y purga las que ya resolvieron sus
 * entregas pendientes. La llama el trabajo periódico `revisionEntregas`.
 */
export async function purgarCuentasCanceladasResueltas(): Promise<number[]> {
  const usuarios = await clientePrisma.usuario.findMany({
    where: { estadoCuenta: "cancelada" },
  });

  const purgadas: number[] = [];
  for (const usuario of usuarios) {
    if (usuario.datosEliminadosEn) continue;

    try {
      if (await purgarCuentaSiCorresponde(Number(usuario.id))) {
        purgadas.push(Number(usuario.id));
      }
    } catch (error) {
      console.error(
        `[cancelacion] No se pudo purgar la cuenta ${usuario.id}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  return purgadas;
}
