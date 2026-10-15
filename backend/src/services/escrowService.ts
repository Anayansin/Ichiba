import { randomInt } from "node:crypto";
import clientePrisma from "../configuracion/prisma.js";
import { Producto } from "../models/producto.js";
import { Venta } from "../models/Venta.js";
import {
  anularAutorizacionPaypal,
  capturarAutorizacionPaypal,
  reembolsarCapturaPaypal,
} from "./paypalService.js";
import { reembolsarPagoMercadoPago } from "./mercadopagoService.js";
import {
  enviarCorreoCodigoEntregaComprador,
  enviarCorreoComprobanteRecibidoVendedor,
  enviarCorreoComprobanteRechazadoComprador,
  enviarCorreoEntregaCompletada,
  enviarCorreoVentaCancelada,
} from "./emailService.js";
import { reanudarFilaTrasCancelacion } from "./filaService.js";
import {
  finDeBloquesDeAtencion,
  finDelSiguienteBloqueDeAtencion,
  formatearFechaHoraZonaCentro,
  obtenerTextoDeProximoBloque,
  type BloqueHorario,
} from "../utils/validarHorario.js";

/**
 * RQNF4 / RQNF20 / RQNF24 / RQNF27 / RQNF28 / RQNF31: ciclo de vida del
 * escrow (dinero retenido hasta que el comprador reciba su producto).
 *
 * Resumen del flujo:
 *
 *   1. El comprador paga: en PayPal se AUTORIZA (dinero retenido, sin cobrar)
 *      y en MercadoPago el cobro entra a la cuenta de la plataforma (escrow
 *      interno). La venta nace en `pendiente_comprobante` con una palabra
 *      clave de 4 dígitos (RQNF20) que solo conoce el comprador.
 *   2. El comprador registra su comprobante (RQF22): palabra clave + número
 *      de referencia + fotografía moderada (RQNF18). Pasa a
 *      `pendiente_confirmacion` y su fila queda en reposo (RQNF24.4).
 *   3. El vendedor confirma o rechaza (RQF31). Al confirmar se abre el chat
 *      (RQNF29), se entrega al comprador un código de entrega de 4 dígitos
 *      (RQNF24.4) y corre el plazo de entrega (RQNF28).
 *   4. El comprador da su código al vendedor el día de la entrega (RQF26);
 *      el vendedor lo registra (RQF33) y el sistema captura el dinero
 *      (RQNF27) y cierra el chat (RQNF26).
 *
 * Cancelaciones automáticas (todas reembolsan al comprador y reanudan la
 * fila): comprobante sin subir en 24 h (RQNF23), vendedor que no confirma
 * antes del fin de su siguiente bloque de atención (RQNF24), entrega fuera
 * del plazo de 15 días (RQNF28), inactividad de 3 bloques del vendedor en el
 * chat (RQNF31) y cuenta de vendedor cancelada (RQNF10.2).
 */

/** RQNF23: el comprador tiene este tiempo para subir su comprobante. */
export const HORAS_LIMITE_COMPROBANTE = 24;

/** RQNF28: días que tiene el vendedor para entregar y registrar el código. */
export const DIAS_LIMITE_ENTREGA = 15;

/** RQNF31: bloques de atención del vendedor sin mensajes antes de cancelar. */
export const BLOQUES_INACTIVIDAD_CHAT = 3;

export type VentaEscrow = {
  id: number;
  productoId: string;
  vendedorId: number;
  compradorId: string;
  monto: number;
  paypalOrderId: string;
  estado: string;
  codigoPago?: string | null;
  autorizacionPaypalId?: string | null;
  comprobantePalabraClave?: string | null;
  comprobanteReferencia?: string | null;
  comprobanteImagen?: string | null;
  comprobanteEnviadoEn?: Date | null;
  comprobanteConfirmadoEn?: Date | null;
  codigoEntrega?: string | null;
  confirmacionLimite?: Date | null;
  entregaLimite?: Date | null;
  ultimoMensajeEn?: Date | null;
  entregadoEn?: Date | null;
  capturaPaypalId?: string | null;
  reembolsadoEn?: Date | null;
  reembolsoId?: string | null;
  canceladoMotivo?: string | null;
  retenido?: boolean;
  calificacionComprador?: number | null;
  calificacionVendedor?: number | null;
  createdAt?: Date;
};

export type UsuarioEscrow = {
  id: number;
  correo: string;
  horarios?: unknown;
};

/** RQNF20: clave numérica de 4 dígitos. */
export function generarCodigo4Digitos(): string {
  return String(randomInt(1000, 10000));
}

/**
 * RQNF20: la clave debe ser única e irrepetible por cada sesión de pago
 * exitosa de una misma fila virtual (mismo producto). Se compara contra
 * todas las ventas previas del producto, aunque hayan sido canceladas.
 */
export async function generarCodigoPagoUnico(
  productoId: string,
): Promise<string> {
  for (let intento = 0; intento < 50; intento += 1) {
    const codigo = generarCodigo4Digitos();
    const repetido = await clientePrisma.venta.findFirst({
      where: { productoId, codigoPago: codigo },
    });
    if (!repetido) return codigo;
  }

  throw new Error(
    "No fue posible generar una palabra clave única para esta venta",
  );
}

export function esVentaDeMercadoPago(venta: {
  paypalOrderId?: string | null;
}): boolean {
  return String(venta.paypalOrderId ?? "").startsWith("mp:");
}

function idPagoMercadoPago(venta: VentaEscrow): string {
  return String(venta.paypalOrderId).slice(3);
}

/** Correo del comprador (el que dejó al entrar a la fila, RQF20). */
export async function correoDelComprador(
  productoId: string,
  compradorId: string,
): Promise<string | null> {
  const fila = await clientePrisma.cola.findFirst({
    where: { productoId, compradorId },
    orderBy: { id: "desc" },
  });
  return fila?.correo ?? null;
}

export function horariosDelVendedor(
  vendedor: UsuarioEscrow | null,
): BloqueHorario[] {
  return Array.isArray(vendedor?.horarios)
    ? (vendedor.horarios as BloqueHorario[])
    : [];
}

/** RQNF24.1: texto del bloque de atención vigente o próximo del vendedor. */
export function avisoDeAtencion(vendedor: UsuarioEscrow | null): string | null {
  const bloque = obtenerTextoDeProximoBloque(
    horariosDelVendedor(vendedor),
    new Date(),
  );
  if (!bloque) return null;
  return `La atención será únicamente dentro del bloque de horario de atención del vendedor (${bloque}). Si escribes fuera de él, te responderá en su siguiente bloque.`;
}

async function cargarVendedor(venta: VentaEscrow): Promise<UsuarioEscrow | null> {
  const vendedor = await clientePrisma.usuario.findUnique({
    where: { id: Number(venta.vendedorId) },
  });
  return (vendedor as UsuarioEscrow | null) ?? null;
}

async function cargarProducto(venta: VentaEscrow) {
  if (!/^[0-9a-fA-F]{24}$/.test(venta.productoId)) return null;
  return Producto.findById(venta.productoId);
}

/** Refleja el estado de PostgreSQL en el espejo de MongoDB. */
export async function actualizarEspejoVenta(
  paypalOrderId: string,
  datos: Record<string, unknown>,
): Promise<void> {
  try {
    await Venta.updateOne({ paypalOrderId }, { $set: datos }, { upsert: false });
  } catch (error) {
    console.error(
      "[escrow] No se pudo actualizar el espejo de la venta en MongoDB:",
      error instanceof Error ? error.message : error,
    );
  }
}

export async function cargarVenta(
  ventaId: number,
): Promise<VentaEscrow | null> {
  const venta = await clientePrisma.venta.findUnique({ where: { id: ventaId } });
  return (venta as VentaEscrow | null) ?? null;
}

/**
 * RQF22 / RQNF18: registra el comprobante de pago del comprador (la imagen
 * ya pasó por la moderación de contenido en el controlador). Deja la venta
 * en `pendiente_confirmacion`, coloca la fila en reposo (RQNF24.4) y fija el
 * plazo del vendedor en el fin de su siguiente bloque de atención (RQNF24).
 */
export async function registrarComprobanteDeVenta(
  venta: VentaEscrow,
  datos: { palabraClave: string; referencia: string; imagen: string },
): Promise<{ error?: string; confirmacionLimite?: Date }> {
  if (venta.estado !== "pendiente_comprobante") {
    return {
      error:
        "Esta compra ya no está pendiente de comprobante; revisa su estado actual.",
    };
  }

  const palabraClave = datos.palabraClave.trim();
  if (!/^\d{4}$/.test(palabraClave)) {
    return { error: "Ingresa la palabra clave de 4 dígitos de tu compra" };
  }

  if (!venta.codigoPago || palabraClave !== venta.codigoPago) {
    return {
      error:
        "La palabra clave no coincide con la de tu sesión de pago. Revisa el correo o la página de tu compra.",
    };
  }

  const referencia = datos.referencia.trim();
  if (referencia.length < 4 || referencia.length > 64) {
    return {
      error:
        "Ingresa el número de referencia de la transferencia (entre 4 y 64 caracteres)",
    };
  }

  if (!datos.imagen) {
    return { error: "Adjunta la fotografía o captura del comprobante" };
  }

  const vendedor = await cargarVendedor(venta);
  const ahora = new Date();
  const confirmacionLimite =
    finDelSiguienteBloqueDeAtencion(horariosDelVendedor(vendedor), ahora) ??
    new Date(ahora.getTime() + HORAS_LIMITE_COMPROBANTE * 60 * 60 * 1000);

  await clientePrisma.venta.update({
    where: { id: venta.id },
    data: {
      estado: "pendiente_confirmacion",
      comprobantePalabraClave: palabraClave,
      comprobanteReferencia: referencia,
      comprobanteImagen: datos.imagen,
      comprobanteEnviadoEn: ahora,
      confirmacionLimite,
    },
  });

  // RQNF24.2 / RQNF24.4: la fila del comprador queda pausada en reposo
  // mientras el vendedor revisa el comprobante.
  await clientePrisma.cola.updateMany({
    where: { productoId: venta.productoId, compradorId: venta.compradorId, estado: "pagada" },
    data: { estado: "reposo" },
  });
  await clientePrisma.cola.updateMany({
    where: { productoId: venta.productoId, compradorId: venta.compradorId, estado: "activa" },
    data: { estado: "reposo" },
  });

  await actualizarEspejoVenta(venta.paypalOrderId, {
    estado: "pendiente_confirmacion",
    comprobantePalabraClave: palabraClave,
    comprobanteReferencia: referencia,
    comprobanteImagen: datos.imagen,
    comprobanteEnviadoEn: ahora,
    confirmacionLimite,
  });

  if (vendedor) {
    try {
      const producto = await cargarProducto(venta);
      await enviarCorreoComprobanteRecibidoVendedor(
        vendedor.correo,
        producto?.nombre ?? "",
        formatearFechaHoraZonaCentro(confirmacionLimite),
      );
    } catch (error) {
      console.error(
        "[escrow] No se pudo avisar al vendedor del comprobante:",
        error instanceof Error ? error.message : error,
      );
    }
  }

  return { confirmacionLimite };
}

/**
 * RQF31 / RQNF27 / RQNF24.4: el vendedor confirma el comprobante. Se abre el
 * chat (RQNF29), se genera el código de entrega del comprador y se fija el
 * plazo de entrega (RQNF28).
 */
export async function confirmarComprobanteDeVenta(
  venta: VentaEscrow,
  vendedorId: number,
): Promise<{ error?: string; codigoEntrega?: string; entregaLimite?: Date }> {
  if (venta.vendedorId !== vendedorId) {
    return { error: "No puedes confirmar el comprobante de esta compra" };
  }
  if (venta.estado !== "pendiente_confirmacion") {
    return { error: "Esta compra no está pendiente de confirmación" };
  }

  const ahora = new Date();
  const codigoEntrega = generarCodigo4Digitos();
  const entregaLimite = new Date(
    ahora.getTime() + DIAS_LIMITE_ENTREGA * 24 * 60 * 60 * 1000,
  );

  await clientePrisma.venta.update({
    where: { id: venta.id },
    data: {
      estado: "en_entrega",
      comprobanteConfirmadoEn: ahora,
      codigoEntrega,
      entregaLimite,
    },
  });

  await actualizarEspejoVenta(venta.paypalOrderId, {
    estado: "en_entrega",
    comprobanteConfirmadoEn: ahora,
    codigoEntrega,
    entregaLimite,
  });

  // RQNF29: con el pago confirmado, el chat de coordinación queda habilitado.
  const correo = await correoDelComprador(
    venta.productoId,
    venta.compradorId,
  );
  if (correo) {
    try {
      const producto = await cargarProducto(venta);
      await enviarCorreoCodigoEntregaComprador(
        correo,
        producto?.nombre ?? "",
        codigoEntrega,
        formatearFechaHoraZonaCentro(entregaLimite),
      );
    } catch (error) {
      console.error(
        "[escrow] No se pudo enviar el código de entrega al comprador:",
        error instanceof Error ? error.message : error,
      );
    }
  }

  return { codigoEntrega, entregaLimite };
}

/**
 * RQF31 / RQNF23: el vendedor rechaza el comprobante. RQNF23 (interpretación
 * aprobada por el cliente): el comprador pierde el turno de inmediato, se le
 * reembolsa y el siguiente en la fila toma el turno (RQNF23.2 / RQNF24.2).
 */
export async function rechazarComprobanteDeVenta(
  venta: VentaEscrow,
  vendedorId: number,
  motivo: string,
): Promise<{ error?: string }> {
  if (venta.vendedorId !== vendedorId) {
    return { error: "No puedes rechazar el comprobante de esta compra" };
  }
  if (venta.estado !== "pendiente_confirmacion") {
    return { error: "Esta compra no está pendiente de confirmación" };
  }

  const motivoFinal =
    motivo.trim() ||
    "El vendedor no reconoció el comprobante de pago recibido";

  const resultado = await cancelarEscrow(venta, {
    motivo: `Comprobante rechazado: ${motivoFinal}`,
    omitirCorreoComprador: true,
  });
  if (resultado.error) return { error: resultado.error };

  const correo = await correoDelComprador(
    venta.productoId,
    venta.compradorId,
  );
  if (correo) {
    try {
      const producto = await cargarProducto(venta);
      await enviarCorreoComprobanteRechazadoComprador(
        correo,
        producto?.nombre ?? "",
        motivoFinal,
      );
    } catch (error) {
      console.error(
        "[escrow] No se pudo avisar del rechazo al comprador:",
        error instanceof Error ? error.message : error,
      );
    }
  }

  return {};
}

/**
 * RQF33 / RQNF27: el vendedor registra el código de entrega que le dio el
 * comprador. Se captura la autorización (el dinero se paga al vendedor en
 * PayPal), la venta queda completada y el chat se cierra (RQNF26).
 */
export async function registrarEntregaDeVenta(
  venta: VentaEscrow,
  vendedorId: number,
  codigo: string,
): Promise<{ error?: string }> {
  if (venta.vendedorId !== vendedorId) {
    return { error: "No puedes registrar la entrega de esta compra" };
  }
  if (venta.estado !== "en_entrega") {
    return {
      error:
        "Esta compra no está en etapa de entrega; revisa su estado actual.",
    };
  }

  const codigoLimpio = codigo.trim();
  if (!/^\d{4}$/.test(codigoLimpio) || codigoLimpio !== venta.codigoEntrega) {
    return {
      error:
        "El código de confirmación de entrega no es válido. Pídeselo de nuevo al comprador.",
    };
  }

  // RQNF27: liberación de fondos.
  let capturaPaypalId: string | null = null;
  if (!esVentaDeMercadoPago(venta)) {
    if (!venta.autorizacionPaypalId) {
      console.warn(
        `[escrow] Venta ${venta.id} sin autorización de PayPal registrada`,
      );
    } else {
      try {
        const captura = await capturarAutorizacionPaypal(
          venta.autorizacionPaypalId,
        );
        capturaPaypalId = captura?.id ?? null;
      } catch (error) {
        const respuesta = (error as any)?.respuestaPaypal;
        const textoError = JSON.stringify(respuesta ?? {});
        if (textoError.includes("ALREADY_CAPTURED")) {
          // La captura ya se hizo (por ejemplo, un reintento): se continúa.
          console.warn(
            `[escrow] La autorización de la venta ${venta.id} ya estaba capturada`,
          );
        } else {
          console.error("[escrow] No se pudo capturar el pago:", error);
          return {
            error:
              "No se pudo liberar el pago al vendedor en este momento. Intenta de nuevo.",
          };
        }
      }
    }
  }

  const ahora = new Date();
  await clientePrisma.venta.update({
    where: { id: venta.id },
    data: {
      estado: "completada",
      entregadoEn: ahora,
      capturaPaypalId,
    },
  });

  // RQNF17: la venta concluyó: la fila del comprador se cierra.
  await clientePrisma.cola.updateMany({
    where: {
      productoId: venta.productoId,
      compradorId: venta.compradorId,
      estado: "reposo",
    },
    data: { estado: "finalizada" },
  });
  await clientePrisma.cola.updateMany({
    where: {
      productoId: venta.productoId,
      compradorId: venta.compradorId,
      estado: "pagada",
    },
    data: { estado: "finalizada" },
  });

  await actualizarEspejoVenta(venta.paypalOrderId, {
    estado: "completada",
    entregadoEn: ahora,
    capturaPaypalId,
  });

  const producto = await cargarProducto(venta);
  const correo = await correoDelComprador(venta.productoId, venta.compradorId);
  const vendedor = await cargarVendedor(venta);

  const promesas: Promise<unknown>[] = [];
  if (correo) {
    promesas.push(
      enviarCorreoEntregaCompletada(correo, producto?.nombre ?? "", false),
    );
  }
  if (vendedor) {
    promesas.push(
      enviarCorreoEntregaCompletada(vendedor.correo, producto?.nombre ?? "", true),
    );
  }
  const resultadosCorreo = await Promise.allSettled(promesas);
  for (const resultadoCorreo of resultadosCorreo) {
    if (resultadoCorreo.status === "rejected") {
      console.error(
        "[escrow] No se pudo enviar un correo de entrega:",
        resultadoCorreo.reason,
      );
    }
  }

  return {};
}

export type OpcionesCancelacion = {
  /** Texto que se guarda como motivo de la cancelación. */
  motivo: string;
  /** Si el llamador manda su propio correo al comprador (p. ej. rechazo). */
  omitirCorreoComprador?: boolean;
};

/**
 * Cancela una compra y devuelve el dinero al comprador:
 *
 *   - PayPal: si el dinero aún está retenido, se anula la autorización (el
 *     comprador nunca ve el cargo). Si ya se había capturado, se reembolsa
 *     la captura.
 *   - MercadoPago: se solicita el reembolso del pago a su API.
 *
 * Después reanuda la fila (RQNF23.2 / RQNF24.2), cierra la fila del
 * comprador y avisa a ambas partes con la hora y día de la resolución
 * (RQNF24). Si `venta.retenido` es true (RQNF32) no se toca: la resuelve un
 * administrador.
 */
export async function cancelarEscrow(
  venta: VentaEscrow,
  opciones: OpcionesCancelacion,
): Promise<{ error?: string; omitida?: boolean }> {
  if (venta.retenido) {
    return { omitida: true };
  }

  if (venta.estado === "completada") {
    return {
      error:
        "Esta venta ya fue completada; un administrador debe resolver el reembolso de una disputa",
    };
  }

  const ahora = new Date();
  let nuevoEstado = "cancelada";
  let reembolsoId: string | null = null;
  let reembolsoTexto =
    "El dinero retenido fue liberado a tu medio de pago: nunca se realizó el cobro.";

  try {
    if (esVentaDeMercadoPago(venta)) {
      // Escrow interno de MercadoPago: el cobro se devuelve por su API.
      const reembolso = await reembolsarPagoMercadoPago(idPagoMercadoPago(venta));
      reembolsoId = String(reembolso?.id ?? "");
      nuevoEstado = "reembolsada";
      reembolsoTexto =
        "MercadoPago procesó el reembolso a tu medio de pago original; puede tardar unos días en reflejarse.";
    } else if (venta.capturaPaypalId) {
      const reembolso = await reembolsarCapturaPaypal(
        venta.capturaPaypalId,
        undefined,
        opciones.motivo,
      );
      reembolsoId = String(reembolso?.id ?? "");
      nuevoEstado = "reembolsada";
      reembolsoTexto =
        "PayPal devolverá el monto del reembolso a tu cuenta; puede tardar unos días en reflejarse.";
    } else if (venta.autorizacionPaypalId) {
      await anularAutorizacionPaypal(venta.autorizacionPaypalId);
      nuevoEstado = "cancelada";
      reembolsoTexto =
        "PayPal liberó el dinero que estaba retenido (autorización anulada): el cargo nunca se completó.";
    }
  } catch (error) {
    const texto = JSON.stringify((error as any)?.respuestaPaypal ?? (error as any)?.respuestaMercadoPago ?? "");
    const yaDevuelto =
      texto.includes("ALREADY_VOIDED") ||
      texto.includes("ALREADY_REFUNDED") ||
      texto.includes("refunded") ||
      texto.includes("already_refunded");

    if (!yaDevuelto) {
      console.error(
        `[escrow] No se pudo reembolsar la venta ${venta.id}:`,
        error,
      );
      await clientePrisma.venta.update({
        where: { id: venta.id },
        data: {
          retenido: true,
          canceladoMotivo: `${opciones.motivo} | El reembolso automático falló: requiere revisión administrativa`,
        },
      });
      return {
        error:
          "El reembolso automático no pudo completarse; la operación quedó retenida para revisión administrativa.",
      };
    }

    nuevoEstado = esVentaDeMercadoPago(venta) ? "reembolsada" : "cancelada";
  }

  await clientePrisma.venta.update({
    where: { id: venta.id },
    data: {
      estado: nuevoEstado,
      canceladoMotivo: opciones.motivo,
      reembolsadoEn: ahora,
      reembolsoId,
    },
  });

  await actualizarEspejoVenta(venta.paypalOrderId, {
    estado: nuevoEstado,
    canceladoMotivo: opciones.motivo,
    reembolsadoEn: ahora,
    reembolsoId,
  });

  // RQNF23.2 / RQNF24.2: la fila del comprador se cierra y el siguiente
  // en espera toma el turno; el producto vuelve a estar a la venta.
  try {
    await reanudarFilaTrasCancelacion(venta.productoId, venta.compradorId);
  } catch (error) {
    console.error(
      "[escrow] No se pudo reanudar la fila tras la cancelación:",
      error instanceof Error ? error.message : error,
    );
  }

  const producto = await cargarProducto(venta);
  const resolucionTexto = formatearFechaHoraZonaCentro(ahora);
  const vendedor = await cargarVendedor(venta);
  const correoComprador = await correoDelComprador(
    venta.productoId,
    venta.compradorId,
  );

  const promesas: Promise<unknown>[] = [];
  if (correoComprador && !opciones.omitirCorreoComprador) {
    promesas.push(
      enviarCorreoVentaCancelada(
        correoComprador,
        producto?.nombre ?? "",
        opciones.motivo,
        resolucionTexto,
        reembolsoTexto,
      ),
    );
  }
  if (vendedor) {
    promesas.push(
      enviarCorreoVentaCancelada(
        vendedor.correo,
        producto?.nombre ?? "",
        opciones.motivo,
        resolucionTexto,
        "El comprador recibió el reembolso correspondiente.",
        true,
      ),
    );
  }
  const resultadosCorreo = await Promise.allSettled(promesas);
  for (const resultadoCorreo of resultadosCorreo) {
    if (resultadoCorreo.status === "rejected") {
      console.error(
        "[escrow] No se pudo enviar un correo de cancelación:",
        resultadoCorreo.reason,
      );
    }
  }

  return {};
}

/**
 * RQNF31: registra actividad de chat en la venta (PostgreSQL y Mongo) para
 * que la inactividad de 3 bloques del vendedor se cuente desde el último
 * mensaje real.
 */
export async function registrarActividadDeChat(datos: {
  productoId: string;
  compradorId: string;
}): Promise<void> {
  try {
    const venta = await clientePrisma.venta.findFirst({
      where: {
        productoId: datos.productoId,
        compradorId: datos.compradorId,
        estado: "en_entrega",
      },
    });
    if (!venta) return;

    const ahora = new Date();
    await clientePrisma.venta.update({
      where: { id: Number(venta.id) },
      data: { ultimoMensajeEn: ahora },
    });
    await Venta.updateOne(
      { paypalOrderId: venta.paypalOrderId },
      { $set: { ultimoMensajeEn: ahora } },
    );
  } catch (error) {
    console.error(
      "[escrow] No se pudo registrar la actividad del chat:",
      error instanceof Error ? error.message : error,
    );
  }
}

/**
 * RQNF31: fecha límite de inactividad del chat para una venta en entrega.
 * Se cuenta desde el último mensaje (o desde la confirmación del comprobante
 * si aún no hay mensajes) y equivale a los próximos 3 bloques de atención
 * del vendedor. Si el vendedor no tiene bloques, se usa la fecha de entrega.
 */
export function limiteDeInactividadDeChat(
  venta: VentaEscrow,
  vendedor: UsuarioEscrow | null,
): Date | null {
  const base =
    venta.ultimoMensajeEn ??
    venta.comprobanteConfirmadoEn ??
    venta.comprobanteEnviadoEn ??
    null;
  if (!base) return null;

  const porBloques = finDeBloquesDeAtencion(
    horariosDelVendedor(vendedor),
    new Date(base),
    BLOQUES_INACTIVIDAD_CHAT,
  );
  if (porBloques) return porBloques;

  return venta.entregaLimite ? new Date(venta.entregaLimite) : null;
}
