import { randomInt } from "node:crypto";
import clientePrisma from "../configuracion/prisma.js";
import { Producto } from "../models/producto.js";
import { Venta } from "../models/Venta.js";
import {
  anularAutorizacionPaypal,
  capturarAutorizacionPaypal,
  comisionPaypalActiva,
  reembolsarCapturaPaypal,
} from "./paypalService.js";
import { calcularComision } from "./comisionService.js";
import {
  enviarCorreoCodigoEntregaComprador,
  enviarCorreoComprobanteRecibidoVendedor,
  enviarCorreoComprobanteRechazadoComprador,
  enviarCorreoEntregaCompletada,
  enviarCorreoVentaCancelada,
} from "./emailService.js";
import { reanudarFilaTrasCancelacion } from "./filaService.js";
import { registrarAdeudo } from "./adeudoService.js";
import type { CausaAdeudo } from "../models/Adeudo.js";
import { publicarResumenAdmin } from "../graphql/suscripciones.js";
import {
  finDeBloquesDeAtencion,
  finDelSiguienteBloqueDeAtencion,
  formatearFechaHoraZonaCentro,
  obtenerTextoDeProximoBloque,
  type BloqueHorario,
} from "../utils/validarHorario.js";

export const HORAS_LIMITE_COMPROBANTE = 24;

export const DIAS_LIMITE_ENTREGA = 15;

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

export function generarCodigo4Digitos(): string {
  return String(randomInt(1000, 10000));
}

const ESTADOS_VENTA_ACTIVA = [
  "pendiente_comprobante",
  "pendiente_confirmacion",
  "en_entrega",
];

export async function generarCodigoPagoUnico(): Promise<string> {
  for (let intento = 0; intento < 50; intento += 1) {
    const codigo = generarCodigo4Digitos();
    const repetido = await clientePrisma.venta.findFirst({
      where: { codigoPago: codigo, estado: { in: ESTADOS_VENTA_ACTIVA } },
    });
    if (!repetido) return codigo;
  }

  throw new Error(
    "No fue posible generar una palabra clave única para esta venta",
  );
}

export async function generarCodigoEntregaUnico(): Promise<string> {
  for (let intento = 0; intento < 50; intento += 1) {
    const codigo = generarCodigo4Digitos();
    const repetido = await clientePrisma.venta.findFirst({
      where: { codigoEntrega: codigo, estado: { in: ESTADOS_VENTA_ACTIVA } },
    });
    if (!repetido) return codigo;
  }
  throw new Error(
    "No fue posible generar un código de entrega único para esta venta",
  );
}

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

  publicarResumenAdmin();
}

export async function cargarVenta(
  ventaId: number,
): Promise<VentaEscrow | null> {
  const venta = await clientePrisma.venta.findUnique({ where: { id: ventaId } });
  return (venta as VentaEscrow | null) ?? null;
}

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
  if (!/^d{6,8}$/.test(referencia)) {
    return {
      error:
        "El número de referencia debe ser numérico y tener entre 6 y 8 dígitos",
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

export async function confirmarComprobanteDeVenta(
  venta: VentaEscrow,
  vendedorId: number,
): Promise<{ error?: string; codigoEntrega?: string; entregaLimite?: Date }> {
  if (venta.vendedorId !== vendedorId) {
    return {
      error: "Solo el vendedor de esta compra puede confirmar el comprobante",
    };
  }
  if (venta.estado !== "pendiente_confirmacion") {
    return { error: "Esta compra no está pendiente de confirmación" };
  }

  const ahora = new Date();
  const codigoEntrega =
    venta.codigoEntrega || (await generarCodigoEntregaUnico());
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

export async function rechazarComprobanteDeVenta(
  venta: VentaEscrow,
  vendedorId: number,
  motivo: string,
): Promise<{ error?: string }> {
  if (venta.vendedorId !== vendedorId) {
    return {
      error: "Solo el vendedor de esta compra puede rechazar el comprobante",
    };
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

  await clientePrisma.cola.updateMany({
    where: {
      productoId: venta.productoId,
      compradorId: venta.compradorId,
      estado: "finalizada",
      motivoCierre: "venta_cancelada",
    },
    data: { motivoCierre: "comprobante_rechazado" },
  });

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

export async function registrarEntregaDeVenta(
  venta: VentaEscrow,
  vendedorId: number,
  codigo: string,
): Promise<{ error?: string }> {
  if (venta.vendedorId !== vendedorId) {
    return {
      error: "Solo el vendedor de esta compra puede registrar la entrega",
    };
  }
  if (venta.estado !== "en_entrega") {
    return {
      error:
        "Esta compra no está en etapa de entrega; revisa su estado actual.",
    };
  }

  if (venta.retenido) {
    return {
      error:
        "Esta venta tiene una retención preventiva de fondos (RQNF32): la administración debe resolverla antes de que puedas liberar el pago.",
    };
  }

  const codigoLimpio = codigo.trim();
  if (!/^\d{4}$/.test(codigoLimpio) || codigoLimpio !== venta.codigoEntrega) {
    return {
      error:
        "El código de confirmación de entrega no es válido. Pídeselo de nuevo al comprador.",
    };
  }

  let capturaPaypalId: string | null = null;
  {
    if (!venta.autorizacionPaypalId) {
      console.warn(
        `[escrow] Venta ${venta.id} sin autorización de PayPal registrada`,
      );
    } else {
      try {
        const captura = await capturarAutorizacionPaypal(
          venta.autorizacionPaypalId,
          Number(venta.monto),
        );
        capturaPaypalId = captura?.id ?? null;
      } catch (error) {
        const respuesta = (error as any)?.respuestaPaypal;
        const textoError = JSON.stringify(respuesta ?? {});
        if (textoError.includes("ALREADY_CAPTURED")) {
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

  await clientePrisma.cola.updateMany({
    where: {
      productoId: venta.productoId,
      compradorId: venta.compradorId,
      estado: "reposo",
    },
    data: { estado: "finalizada", motivoCierre: "venta_completada" },
  });
  await clientePrisma.cola.updateMany({
    where: {
      productoId: venta.productoId,
      compradorId: venta.compradorId,
      estado: "pagada",
    },
    data: { estado: "finalizada", motivoCierre: "venta_completada" },
  });
  await clientePrisma.cola.updateMany({
    where: {
      productoId: venta.productoId,
      estado: {
        in: ["activa", "esperando_apertura", "esperando_confirmacion"],
      },
    },
    data: { estado: "finalizada", motivoCierre: "vendido_a_otro" },
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
  motivo: string;
  omitirCorreoComprador?: boolean;
  omitirCorreoVendedor?: boolean;
  resolverRetencion?: boolean;
  culpaVendedor?: { causa: CausaAdeudo };
};

export async function cancelarEscrow(
  venta: VentaEscrow,
  opciones: OpcionesCancelacion,
): Promise<{
  error?: string;
  omitida?: boolean;
  reembolsoId?: string | null;
  adeudoId?: string;
}> {
  if (venta.retenido && !opciones.resolverRetencion) {
    return { omitida: true };
  }

  if (venta.estado === "completada" && !opciones.resolverRetencion) {
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
    if (venta.capturaPaypalId) {
      const comision = comisionPaypalActiva()
        ? calcularComision(Number(venta.monto)).total
        : undefined;
      const reembolso = await reembolsarCapturaPaypal(
        venta.capturaPaypalId,
        undefined,
        opciones.motivo,
        comision,
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
    const texto = JSON.stringify((error as any)?.respuestaPaypal ?? "");
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

    nuevoEstado = "cancelada";
  }

  await clientePrisma.venta.update({
    where: { id: venta.id },
    data: {
      estado: nuevoEstado,
      canceladoMotivo: opciones.motivo,
      reembolsadoEn: ahora,
      reembolsoId,
      ...(opciones.resolverRetencion ? { retenido: false } : {}),
    },
  });

  await actualizarEspejoVenta(venta.paypalOrderId, {
    estado: nuevoEstado,
    canceladoMotivo: opciones.motivo,
    reembolsadoEn: ahora,
    reembolsoId,
    ...(opciones.resolverRetencion ? { retenido: false } : {}),
  });

  try {
    await reanudarFilaTrasCancelacion(venta.productoId, venta.compradorId);
  } catch (error) {
    console.error(
      "[escrow] No se pudo reanudar la fila tras la cancelación:",
      error instanceof Error ? error.message : error,
    );
  }

  let adeudoId: string | undefined;
  if (opciones.culpaVendedor) {
    try {
      const adeudo = await registrarAdeudo({
        usuarioId: Number(venta.vendedorId),
        venta: {
          id: venta.id,
          productoId: venta.productoId,
          paypalOrderId: venta.paypalOrderId,
          monto: Number(venta.monto),
        },
        motivo: opciones.motivo,
        causa: opciones.culpaVendedor.causa,
      });
      adeudoId = adeudo.id;
    } catch (error) {
      console.error(
        "[escrow] No se pudo registrar el adeudo del vendedor:",
        error instanceof Error ? error.message : error,
      );
    }
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
  if (vendedor && !opciones.omitirCorreoVendedor) {
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

  return { reembolsoId, adeudoId };
}

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
