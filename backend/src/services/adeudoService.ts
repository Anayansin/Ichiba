import mongoose from "mongoose";
import clientePrisma from "../configuracion/prisma.js";
import { Adeudo, type CausaAdeudo } from "../models/Adeudo.js";
import { Producto } from "../models/producto.js";
import { Usuario } from "../models/usuario.js";
import { ErrorBackoffice } from "./errorBackoffice.js";
import {
  enviarCorreoAdeudoLiquidado,
  enviarCorreoAdeudoRegistrado,
} from "./emailService.js";
import {
  publicarEventoUsuario,
  publicarResumenAdmin,
} from "../graphql/suscripciones.js";
import { resumirUsuario } from "./resumenAdminService.js";

/**
 * RQNF37 / RQNF38: adeudos de los vendedores con la plataforma.
 *
 * RQNF37: cuando la plataforma cubre económicamente un reembolso por culpa
 * directa del vendedor (no confirmó el comprobante, no entregó en el plazo de
 * 15 días, inactividad en el chat de coordinación o una disputa resuelta en
 * su contra) se registra un adeudo por el monto reembolsado, la cuenta queda
 * suspendida con `motivoSuspension = "saldo_pendiente"` y el saldo se acumula
 * en el espejo de MongoDB del BackOffice. El vendedor suspendido solo puede
 * terminar entregas en curso.
 *
 * RQNF38: la reactivación queda condicionada a que la administración
 * registre la liquidación total del adeudo (el pago se hace por fuera de la
 * aplicación, por transferencia). Al liquidarse el último adeudo se levanta
 * la suspensión por saldo y se avisa al vendedor por correo.
 */

export type AdeudoSerializado = {
  id: string;
  usuarioId: number;
  vendedorNombre: string;
  ventaIdPg: number;
  productoNombre: string;
  monto: number;
  motivo: string;
  causa: string;
  estado: string;
  fecha: Date;
  liquidadoEn: Date | null;
  liquidadoPor: string | null;
  nota: string | null;
};

export const ADEUDOS_POR_PAGINA = 10;

function serializarAdeudo(
  adeudo: any,
  vendedorNombre = "",
): AdeudoSerializado {
  return {
    id: String(adeudo._id),
    usuarioId: Number(adeudo.usuarioId),
    vendedorNombre,
    ventaIdPg: Number(adeudo.ventaIdPg),
    productoNombre: String(adeudo.productoNombre ?? "Producto no encontrado"),
    monto: Number(adeudo.monto),
    motivo: String(adeudo.motivo ?? ""),
    causa: String(adeudo.causa ?? "otro"),
    estado: String(adeudo.estado ?? "pendiente"),
    fecha: adeudo.createdAt ?? new Date(),
    liquidadoEn: adeudo.liquidadoEn ? new Date(adeudo.liquidadoEn) : null,
    liquidadoPor: adeudo.liquidadoPor ? String(adeudo.liquidadoPor) : null,
    nota: adeudo.nota ? String(adeudo.nota) : null,
  };
}

/** Nombre y correo del vendedor (espejo de MongoDB y respaldo en PostgreSQL). */
export async function contactoDelVendedor(
  usuarioId: number,
): Promise<{ correo: string; nombre: string } | null> {
  const espejo = await Usuario.findOne({ usuarioId }).lean();
  if (espejo?.correo) {
    return {
      correo: String(espejo.correo),
      nombre: String(espejo.nombreCompleto ?? ""),
    };
  }

  const enPg = await clientePrisma.usuario.findUnique({
    where: { id: usuarioId },
    select: { correo: true, nombreCompleto: true },
  });
  if (!enPg?.correo) return null;
  return {
    correo: String(enPg.correo),
    nombre: String(enPg.nombreCompleto ?? ""),
  };
}

/** Nombre visible de un administrador (para registrar quién liquidó). */
async function nombreDelAdmin(adminId: number | null): Promise<string> {
  if (adminId === null) return "Administración de Ichiba";
  const espejo = await Usuario.findOne({ usuarioId: adminId })
    .select("nombreCompleto")
    .lean();
  return espejo?.nombreCompleto
    ? String(espejo.nombreCompleto)
    : `Administrador #${adminId}`;
}

/**
 * RQNF37: registra un adeudo por un reembolso cubierto por la plataforma,
 * suspende al vendedor con saldo pendiente y avisa por correo. El llamador
 * (cancelaciones automáticas del escrow o el dictamen de una disputa) ya
 * verificó que el reembolso es por culpa directa del vendedor.
 */
export async function registrarAdeudo(datos: {
  usuarioId: number;
  venta: {
    id: number;
    productoId: string;
    paypalOrderId: string;
    monto: number;
  };
  motivo: string;
  causa: CausaAdeudo;
}): Promise<AdeudoSerializado> {
  const producto = /^[0-9a-fA-F]{24}$/.test(datos.venta.productoId)
    ? await Producto.findById(datos.venta.productoId).select("nombre").lean()
    : null;

  const adeudo = await Adeudo.create({
    usuarioId: datos.usuarioId,
    ventaIdPg: datos.venta.id,
    paypalOrderId: datos.venta.paypalOrderId,
    productoId: /^[0-9a-fA-F]{24}$/.test(datos.venta.productoId)
      ? datos.venta.productoId
      : undefined,
    productoNombre: producto?.nombre ?? "Producto no encontrado",
    monto: Number(datos.venta.monto),
    motivo: datos.motivo,
    causa: datos.causa,
  });

  // El espejo del BackOffice refleja el saldo acumulado y la suspensión: el
  // vendedor solo podrá terminar entregas en curso hasta liquidar (RQNF38).
  const actualizado = await Usuario.findOneAndUpdate(
    { usuarioId: datos.usuarioId },
    {
      $inc: { saldoPendiente: Number(datos.venta.monto) },
      $set: { suspendido: true, motivoSuspension: "saldo_pendiente" },
    },
    { new: true },
  ).lean();

  const contacto = await contactoDelVendedor(datos.usuarioId);
  if (contacto) {
    try {
      await enviarCorreoAdeudoRegistrado(contacto.correo, contacto.nombre, {
        producto: producto?.nombre ?? "",
        monto: Number(datos.venta.monto),
        motivo: datos.motivo,
        saldoTotal: Number(actualizado?.saldoPendiente ?? datos.venta.monto),
      });
    } catch (error) {
      console.error(
        "[adeudos] No se pudo enviar el correo del adeudo:",
        error instanceof Error ? error.message : error,
      );
    }
  }

  if (actualizado) {
    await publicarEventoUsuario(
      "adeudo",
      `Adeudo de $${Number(datos.venta.monto).toFixed(2)} registrado para ${actualizado.nombreCompleto} (RQNF37)`,
      resumirUsuario(actualizado),
    );
  }
  publicarResumenAdmin();

  return serializarAdeudo(adeudo, String(actualizado?.nombreCompleto ?? ""));
}

export type ListadoAdeudos = {
  adeudos: AdeudoSerializado[];
  pagina: number;
  porPagina: number;
  total: number;
  totalPaginas: number;
  /** Suma de todos los adeudos pendientes de liquidar. */
  pendienteTotal: number;
};

/** RQNF37: listado paginado de adeudos para el BackOffice. */
export async function listarAdeudosAdmin(opciones: {
  pagina?: number;
  porPagina?: number;
  estado?: string;
  usuarioId?: number;
}): Promise<ListadoAdeudos> {
  const pagina = Math.max(Number(opciones.pagina) || 1, 1);
  const porPagina = Math.max(
    Number(opciones.porPagina) || ADEUDOS_POR_PAGINA,
    1,
  );

  const filtro: Record<string, unknown> = {};
  if (opciones.estado === "pendiente" || opciones.estado === "liquidado") {
    filtro.estado = opciones.estado;
  }
  if (Number.isInteger(Number(opciones.usuarioId))) {
    filtro.usuarioId = Number(opciones.usuarioId);
  }

  const [adeudos, total, todosPendientes] = await Promise.all([
    Adeudo.find(filtro)
      .sort({ createdAt: -1 })
      .skip((pagina - 1) * porPagina)
      .limit(porPagina)
      .lean(),
    Adeudo.countDocuments(filtro),
    Adeudo.find({ estado: "pendiente" }).select("monto").lean(),
  ]);

  const nombres = new Map<number, string>();
  for (const adeudo of adeudos) {
    const id = Number(adeudo.usuarioId);
    if (nombres.has(id)) continue;
    const contacto = await contactoDelVendedor(id);
    nombres.set(id, contacto?.nombre || `Vendedor #${id}`);
  }

  return {
    adeudos: adeudos.map((adeudo) =>
      serializarAdeudo(adeudo, nombres.get(Number(adeudo.usuarioId)) ?? ""),
    ),
    pagina,
    porPagina,
    total,
    totalPaginas: Math.max(Math.ceil(total / porPagina), 1),
    pendienteTotal: todosPendientes.reduce(
      (suma, adeudo) => suma + Number(adeudo.monto ?? 0),
      0,
    ),
  };
}

/**
 * RQNF38: registra la liquidación total de un adeudo (pago por transferencia
 * fuera de la aplicación). Descuenta el monto del saldo pendiente del
 * vendedor y, cuando el saldo llega a cero, levanta la suspensión por saldo
 * para que la cuenta pueda volver a operar.
 */
export async function liquidarAdeudoAdmin(
  id: unknown,
  opciones: { nota?: string; adminId?: number | null } = {},
): Promise<{
  message: string;
  adeudo: AdeudoSerializado;
  saldoPendiente: number;
  reactivado: boolean;
}> {
  const texto = String(id ?? "").trim();
  if (!texto || !mongoose.isValidObjectId(texto)) {
    throw new ErrorBackoffice(400, "Indica el adeudo que quieres liquidar");
  }

  const adeudo = await Adeudo.findById(texto);
  if (!adeudo) {
    throw new ErrorBackoffice(404, "Adeudo no encontrado");
  }
  if (adeudo.estado === "liquidado") {
    throw new ErrorBackoffice(400, "Este adeudo ya fue liquidado");
  }

  const ahora = new Date();
  const registradoPor = await nombreDelAdmin(opciones.adminId ?? null);
  adeudo.estado = "liquidado";
  adeudo.liquidadoEn = ahora;
  adeudo.liquidadoPor = registradoPor;
  adeudo.nota = (opciones.nota ?? "").trim() || undefined;
  await adeudo.save();

  const usuarioId = Number(adeudo.usuarioId);
  const espejo = await Usuario.findOne({ usuarioId }).lean();
  const saldoActual = Number(espejo?.saldoPendiente ?? 0);
  const saldoNuevo = Math.max(0, saldoActual - Number(adeudo.monto));

  let reactivado = false;
  const actualizacion: Record<string, unknown> = { saldoPendiente: saldoNuevo };
  if (
    saldoNuevo === 0 &&
    espejo?.suspendido === true &&
    String(espejo?.motivoSuspension ?? "") === "saldo_pendiente"
  ) {
    actualizacion.suspendido = false;
    actualizacion.motivoSuspension = null;
    reactivado = true;
  }

  const actualizado = await Usuario.findOneAndUpdate(
    { usuarioId },
    { $set: actualizacion },
    { new: true },
  ).lean();

  const contacto = await contactoDelVendedor(usuarioId);
  if (contacto) {
    try {
      await enviarCorreoAdeudoLiquidado(contacto.correo, contacto.nombre, {
        monto: Number(adeudo.monto),
        saldoRestante: saldoNuevo,
      });
    } catch (error) {
      console.error(
        "[adeudos] No se pudo enviar el correo de la liquidación:",
        error instanceof Error ? error.message : error,
      );
    }
  }

  if (actualizado) {
    await publicarEventoUsuario(
      "adeudo_liquidado",
      reactivado
        ? `Se liquidó el adeudo de ${actualizado.nombreCompleto}: la suspensión por saldo quedó levantada (RQNF38)`
        : `Se liquidó un adeudo de ${actualizado.nombreCompleto}; saldo restante $${saldoNuevo.toFixed(2)} (RQNF38)`,
      resumirUsuario(actualizado),
    );
  }
  publicarResumenAdmin();

  return {
    message: reactivado
      ? "Liquidación registrada: el adeudo quedó saldado y la cuenta puede volver a operar"
      : `Liquidación registrada; queda un saldo pendiente de $${saldoNuevo.toFixed(2)}`,
    adeudo: serializarAdeudo(adeudo, String(actualizado?.nombreCompleto ?? "")),
    saldoPendiente: saldoNuevo,
    reactivado,
  };
}
