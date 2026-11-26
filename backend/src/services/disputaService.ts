import mongoose from "mongoose";
import clientePrisma from "../configuracion/prisma.js";
import { Disputa } from "../models/Disputa.js";
import { Venta } from "../models/Venta.js";
import { Producto } from "../models/producto.js";
import { CAUSAS_ADEUDO, type CausaAdeudo } from "../models/Adeudo.js";
import { ErrorBackoffice } from "./errorBackoffice.js";
import {
  actualizarEspejoVenta,
  cancelarEscrow,
  cargarVenta,
  correoDelComprador,
  type VentaEscrow,
} from "./escrowService.js";
import { contactoDelVendedor, registrarAdeudo } from "./adeudoService.js";
import {
  enviarCorreoDisputaAbiertaVendedor,
  enviarCorreoDisputaRespondidaComprador,
  enviarCorreoDisputaResuelta,
} from "./emailService.js";
import {
  publicarDisputasActualizadas,
  publicarResumenAdmin,
} from "../graphql/suscripciones.js";

export const DISPUTAS_POR_PAGINA = 10;
export const MAX_EVIDENCIAS = 5;

export const ESTADOS_VENTA_DISPUTABLES = ["en_entrega", "completada"];

export const ESTADOS_VENTA_PRE_ENTREGA = [
  "pendiente_comprobante",
  "pendiente_confirmacion",
  "en_entrega",
];

export type DisputaSerializada = {
  id: string;
  ventaIdPg: number;
  ventaMongoId: string | null;
  productoNombre: string;
  compradorId: string;
  vendedorId: number;
  vendedorNombre: string;
  monto: number;
  motivo: string;
  descripcion: string | null;
  evidenciasComprador: string[];
  respuestaVendedor: string | null;
  evidenciasVendedor: string[];
  respondidaEn: Date | null;
  estado: string;
  resueltaEn: Date | null;
  resueltaPor: string | null;
  notaAdmin: string | null;
  reembolsoId: string | null;
  ventaEstado: string | null;
  fecha: Date;
};

export type VentaRetenidaSerializada = {
  ventaId: number;
  ventaMongoId: string | null;
  estado: string;
  monto: number;
  productoNombre: string;
  compradorId: string;
  vendedorId: number;
  vendedorNombre: string;
  canceladoMotivo: string | null;
  tieneDisputaAbierta: boolean;
  reportesPendientes: number;
  reportesConfirmados: number;
  fecha: Date;
};

export type ListadoDisputas = {
  disputas: DisputaSerializada[];
  ventasRetenidas: VentaRetenidaSerializada[];
  abiertas: number;
  pagina: number;
  porPagina: number;
  total: number;
  totalPaginas: number;
};

function urlEvidencias(idDisputa: unknown, lado: "comprador" | "vendedor", rutas: string[] | undefined): string[] {
  return (rutas ?? []).map(
    (_ruta, indice) =>
      `/api/pagos/disputas/${String(idDisputa)}/evidencia/${lado}/${indice}`,
  );
}

function serializarDisputa(
  disputa: any,
  extras: { vendedorNombre?: string; ventaEstado?: string | null } = {},
): DisputaSerializada {
  return {
    id: String(disputa._id),
    ventaIdPg: Number(disputa.ventaIdPg),
    ventaMongoId: disputa.ventaMongoId ? String(disputa.ventaMongoId) : null,
    productoNombre: String(disputa.productoNombre ?? "Producto no encontrado"),
    compradorId: String(disputa.compradorId ?? ""),
    vendedorId: Number(disputa.vendedorId),
    vendedorNombre: extras.vendedorNombre ?? "",
    monto: Number(disputa.monto ?? 0),
    motivo: String(disputa.motivo ?? ""),
    descripcion: disputa.descripcion ? String(disputa.descripcion) : null,
    evidenciasComprador: urlEvidencias(
      disputa._id,
      "comprador",
      disputa.evidenciasComprador,
    ),
    respuestaVendedor: disputa.respuestaVendedor
      ? String(disputa.respuestaVendedor)
      : null,
    evidenciasVendedor: urlEvidencias(
      disputa._id,
      "vendedor",
      disputa.evidenciasVendedor,
    ),
    respondidaEn: disputa.respondidaEn ? new Date(disputa.respondidaEn) : null,
    estado: String(disputa.estado ?? "abierta"),
    resueltaEn: disputa.resueltaEn ? new Date(disputa.resueltaEn) : null,
    resueltaPor: disputa.resueltaPor ? String(disputa.resueltaPor) : null,
    notaAdmin: disputa.notaAdmin ? String(disputa.notaAdmin) : null,
    reembolsoId: disputa.reembolsoId ? String(disputa.reembolsoId) : null,
    ventaEstado: extras.ventaEstado ?? null,
    fecha: disputa.createdAt ?? new Date(),
  };
}

async function nombreDelAdmin(adminId: number | null): Promise<string> {
  if (adminId === null) return "Administración de Ichiba";
  const cuenta = await clientePrisma.usuario.findUnique({
    where: { id: adminId },
    select: { nombreCompleto: true },
  });
  return cuenta?.nombreCompleto
    ? String(cuenta.nombreCompleto)
    : `Administrador #${adminId}`;
}

async function retenerVenta(venta: VentaEscrow, origen: string): Promise<void> {
  if (venta.retenido) return;

  await clientePrisma.venta.update({
    where: { id: venta.id },
    data: { retenido: true },
  });
  await actualizarEspejoVenta(venta.paypalOrderId, { retenido: true });

  console.log(
    `[disputas] Retención preventiva (${origen}) sobre la venta ${venta.id}`,
  );
}

async function reportesVivosDeVenta(ventaIdPg: number): Promise<number> {
  const reportes = await clientePrisma.reporte.findMany({
    where: { ventaId: String(ventaIdPg) },
  });
  return reportes.filter((reporte) => String(reporte.estado) !== "rechazado")
    .length;
}

export async function marcarVentaRetenidaPorReporte(
  ventaIdPg: number,
): Promise<boolean> {
  if (!Number.isInteger(ventaIdPg)) return false;

  const venta = await cargarVenta(ventaIdPg);
  if (!venta || venta.retenido) return false;
  if (!ESTADOS_VENTA_PRE_ENTREGA.includes(String(venta.estado))) return false;

  await retenerVenta(venta, "reporte");

  await publicarDisputasActualizadas(
    "retencion",
    `Retención preventiva por un reporte sobre la venta ${venta.id}`,
  );
  publicarResumenAdmin();

  return true;
}

export async function liberarRetencionSiCorresponde(
  ventaIdPg: number,
): Promise<boolean> {
  if (!Number.isInteger(ventaIdPg)) return false;

  const [disputasAbiertas, reportesVivos] = await Promise.all([
    Disputa.countDocuments({ ventaIdPg, estado: "abierta" }),
    reportesVivosDeVenta(ventaIdPg),
  ]);
  if (disputasAbiertas > 0 || reportesVivos > 0) return false;

  const venta = await cargarVenta(ventaIdPg);
  if (!venta || !venta.retenido) return false;

  await clientePrisma.venta.update({
    where: { id: venta.id },
    data: { retenido: false },
  });
  await actualizarEspejoVenta(venta.paypalOrderId, { retenido: false });

  await publicarDisputasActualizadas(
    "retencion_liberada",
    `Se retiró la retención preventiva de la venta ${venta.id}`,
  );
  publicarResumenAdmin();

  return true;
}

export async function crearDisputa(datos: {
  compradorId: string;
  ventaId: unknown;
  motivo: string;
  descripcion?: string;
  evidencias?: string[];
}): Promise<{ message: string; disputa: DisputaSerializada }> {
  const ventaId = Number(datos.ventaId);
  if (!Number.isInteger(ventaId)) {
    throw new ErrorBackoffice(404, "Compra no encontrada");
  }

  const venta = await cargarVenta(ventaId);
  if (!venta) {
    throw new ErrorBackoffice(404, "Compra no encontrada");
  }

  if (venta.compradorId !== datos.compradorId) {
    throw new ErrorBackoffice(
      403,
      "Solo el comprador de esta compra puede abrir la disputa",
    );
  }

  if (!ESTADOS_VENTA_DISPUTABLES.includes(String(venta.estado))) {
    throw new ErrorBackoffice(
      400,
      "Solo puedes abrir una disputa cuando la compra está en entrega o ya fue completada",
    );
  }

  const motivo = (datos.motivo ?? "").trim();
  if (!motivo) {
    throw new ErrorBackoffice(400, "Indica el motivo de tu disputa");
  }
  if (motivo.length > 200) {
    throw new ErrorBackoffice(400, "El motivo de la disputa es demasiado largo");
  }

  const descripcion = (datos.descripcion ?? "").trim();
  if (descripcion.length > 2000) {
    throw new ErrorBackoffice(400, "La descripción de la disputa es demasiado larga");
  }

  const existente = await Disputa.findOne({ ventaIdPg: ventaId })
    .select("estado")
    .lean();
  if (existente) {
    throw new ErrorBackoffice(
      400,
      existente.estado === "abierta"
        ? "Ya tienes una disputa abierta para esta compra; la administración la está revisando"
        : "Esta compra ya tuvo una disputa resuelta; solo se admite una por compra",
    );
  }

  const espejo = await Venta.findOne({ paypalOrderId: venta.paypalOrderId })
    .select("_id")
    .lean();
  const producto = /^[0-9a-fA-F]{24}$/.test(venta.productoId)
    ? await Producto.findById(venta.productoId).select("nombre").lean()
    : null;

  const evidencias = (datos.evidencias ?? []).slice(0, MAX_EVIDENCIAS);

  const disputa = await Disputa.create({
    ventaIdPg: ventaId,
    ventaMongoId: espejo?._id,
    paypalOrderId: venta.paypalOrderId,
    productoId: /^[0-9a-fA-F]{24}$/.test(venta.productoId)
      ? venta.productoId
      : undefined,
    productoNombre: producto?.nombre ?? "Producto no encontrado",
    compradorId: venta.compradorId,
    vendedorId: Number(venta.vendedorId),
    monto: Number(venta.monto),
    motivo,
    descripcion: descripcion || undefined,
    evidenciasComprador: evidencias,
  });

  await retenerVenta(venta, "disputa");

  const contacto = await contactoDelVendedor(Number(venta.vendedorId));
  if (contacto) {
    try {
      await enviarCorreoDisputaAbiertaVendedor(
        contacto.correo,
        producto?.nombre ?? "",
        {
          motivo,
          descripcion: descripcion || "(sin descripción)",
          monto: Number(venta.monto),
        },
      );
    } catch (error) {
      console.error(
        "[disputas] No se pudo avisar al vendedor de la disputa:",
        error instanceof Error ? error.message : error,
      );
    }
  }

  await publicarDisputasActualizadas(
    "abierta",
    `El comprador abrió una disputa de $${Number(venta.monto).toFixed(2)} por ${disputa.productoNombre}`,
  );
  publicarResumenAdmin();

  return {
    message:
      "Disputa abierta: el pago queda retenido y la administración revisará las evidencias de ambas partes",
    disputa: serializarDisputa(disputa, {
      vendedorNombre: contacto?.nombre ?? "",
      ventaEstado: String(venta.estado),
    }),
  };
}

export async function responderDisputa(datos: {
  vendedorId: number;
  disputaId: unknown;
  respuesta: string;
  evidencias?: string[];
}): Promise<{ message: string; disputa: DisputaSerializada }> {
  const id = String(datos.disputaId ?? "").trim();
  if (!id || !mongoose.isValidObjectId(id)) {
    throw new ErrorBackoffice(404, "Disputa no encontrada");
  }

  const disputa = await Disputa.findById(id);
  if (!disputa) {
    throw new ErrorBackoffice(404, "Disputa no encontrada");
  }

  if (Number(disputa.vendedorId) !== Number(datos.vendedorId)) {
    throw new ErrorBackoffice(
      403,
      "Solo el vendedor de esta compra puede responder la disputa",
    );
  }

  if (disputa.estado !== "abierta") {
    throw new ErrorBackoffice(400, "Esta disputa ya fue resuelta");
  }

  if (disputa.respondidaEn) {
    throw new ErrorBackoffice(
      400,
      "Ya respondiste esta disputa; la administración la está revisando",
    );
  }

  const respuesta = (datos.respuesta ?? "").trim();
  if (!respuesta) {
    throw new ErrorBackoffice(400, "Escribe tu respuesta para la administración");
  }
  if (respuesta.length > 2000) {
    throw new ErrorBackoffice(400, "La respuesta es demasiado larga");
  }

  disputa.respuestaVendedor = respuesta;
  disputa.evidenciasVendedor = (datos.evidencias ?? []).slice(
    0,
    MAX_EVIDENCIAS,
  );
  disputa.respondidaEn = new Date();
  await disputa.save();

  const venta = await cargarVenta(Number(disputa.ventaIdPg));
  const correoComprador = venta
    ? await correoDelComprador(venta.productoId, venta.compradorId)
    : null;
  if (correoComprador) {
    try {
      await enviarCorreoDisputaRespondidaComprador(
        correoComprador,
        String(disputa.productoNombre ?? ""),
        respuesta,
      );
    } catch (error) {
      console.error(
        "[disputas] No se pudo avisar al comprador de la respuesta:",
        error instanceof Error ? error.message : error,
      );
    }
  }

  await publicarDisputasActualizadas(
    "respondida",
    `El vendedor respondió la disputa de ${disputa.productoNombre ?? "una venta"}`,
  );
  publicarResumenAdmin();

  return {
    message:
      "Respuesta enviada: la administración revisará las evidencias de ambas partes",
    disputa: serializarDisputa(disputa, {
      ventaEstado: venta ? String(venta.estado) : null,
    }),
  };
}

export async function listarDisputasDeComprador(
  compradorId: string,
): Promise<DisputaSerializada[]> {
  const disputas = await Disputa.find({ compradorId })
    .sort({ createdAt: -1 })
    .lean();

  const estados = await estadosDeVentas(
    disputas.map((disputa) => Number(disputa.ventaIdPg)),
  );

  return disputas.map((disputa) =>
    serializarDisputa(disputa, {
      ventaEstado: estados.get(Number(disputa.ventaIdPg)) ?? null,
    }),
  );
}

export async function listarDisputasDeVendedor(
  vendedorId: number,
): Promise<DisputaSerializada[]> {
  const disputas = await Disputa.find({ vendedorId })
    .sort({ createdAt: -1 })
    .lean();

  const estados = await estadosDeVentas(
    disputas.map((disputa) => Number(disputa.ventaIdPg)),
  );

  return disputas.map((disputa) =>
    serializarDisputa(disputa, {
      ventaEstado: estados.get(Number(disputa.ventaIdPg)) ?? null,
    }),
  );
}

async function estadosDeVentas(
  ids: number[],
): Promise<Map<number, string>> {
  const estados = new Map<number, string>();
  const ventas = (await clientePrisma.venta.findMany({
    where: {},
  })) as VentaEscrow[];
  const buscados = new Set(ids);
  for (const venta of ventas) {
    if (buscados.has(Number(venta.id))) {
      estados.set(Number(venta.id), String(venta.estado));
    }
  }
  return estados;
}

export async function resolverDisputaAdmin(
  id: unknown,
  dictamen: unknown,
  opciones: { nota?: string; adminId?: number | null } = {},
): Promise<{
  message: string;
  dictamen: "reembolsar" | "rechazar";
  disputa: DisputaSerializada;
  reembolsada: boolean;
  adeudoId?: string;
  retencionLiberada: boolean;
}> {
  const texto = String(id ?? "").trim();
  if (!texto || !mongoose.isValidObjectId(texto)) {
    throw new ErrorBackoffice(400, "Indica la disputa que quieres resolver");
  }
  if (dictamen !== "reembolsar" && dictamen !== "rechazar") {
    throw new ErrorBackoffice(400, "El dictamen debe ser reembolsar o rechazar");
  }

  const disputa = await Disputa.findById(texto);
  if (!disputa) {
    throw new ErrorBackoffice(404, "Disputa no encontrada");
  }
  if (disputa.estado !== "abierta") {
    throw new ErrorBackoffice(400, "Esta disputa ya fue resuelta");
  }

  const venta = await cargarVenta(Number(disputa.ventaIdPg));
  if (!venta) {
    throw new ErrorBackoffice(404, "La compra de esta disputa no existe");
  }

  const nota = (opciones.nota ?? "").trim();
  const resueltaPor = await nombreDelAdmin(opciones.adminId ?? null);
  const ahora = new Date();

  let reembolsada = false;
  let adeudoId: string | undefined;
  let reembolsoId: string | null = null;

  if (dictamen === "reembolsar") {
    const resultado = await cancelarEscrow(venta, {
      motivo: `Disputa resuelta a favor del comprador: ${disputa.motivo}`,
      resolverRetencion: true,
      culpaVendedor: { causa: "disputa_vendedor" },
      omitirCorreoComprador: true,
      omitirCorreoVendedor: true,
    });

    if (resultado.error) {
      throw new ErrorBackoffice(502, resultado.error);
    }

    reembolsada = true;
    reembolsoId = resultado.reembolsoId ?? null;
    adeudoId = resultado.adeudoId;
  }

  disputa.estado = reembolsada ? "reembolsada" : "rechazada";
  disputa.resueltaEn = ahora;
  disputa.resueltaPor = resueltaPor;
  disputa.notaAdmin = nota || undefined;
  if (reembolsoId) disputa.reembolsoId = reembolsoId;
  await disputa.save();

  const retencionLiberada = reembolsada
    ? true
    : await liberarRetencionSiCorresponde(Number(disputa.ventaIdPg));

  const nombreProducto = String(disputa.productoNombre ?? "");
  const monto = Number(disputa.monto ?? 0);
  const promesas: Promise<unknown>[] = [];

  const correoComprador = await correoDelComprador(
    venta.productoId,
    venta.compradorId,
  );
  if (correoComprador) {
    promesas.push(
      enviarCorreoDisputaResuelta(correoComprador, nombreProducto, {
        reembolsada,
        nota,
        esVendedor: false,
        monto,
      }),
    );
  }

  const contactoVendedor = await contactoDelVendedor(Number(disputa.vendedorId));
  if (contactoVendedor) {
    promesas.push(
      enviarCorreoDisputaResuelta(contactoVendedor.correo, nombreProducto, {
        reembolsada,
        nota,
        esVendedor: true,
        monto,
      }),
    );
  }

  const resultadosCorreo = await Promise.allSettled(promesas);
  for (const resultadoCorreo of resultadosCorreo) {
    if (resultadoCorreo.status === "rejected") {
      console.error(
        "[disputas] No se pudo enviar un correo de resolución:",
        resultadoCorreo.reason,
      );
    }
  }

  await publicarDisputasActualizadas(
    reembolsada ? "reembolsada" : "rechazada",
    reembolsada
      ? `Disputa reembolsada: se devolvieron $${monto.toFixed(2)} al comprador${adeudoId ? " y se registró el adeudo del vendedor" : ""}`
      : "Se rechazó una disputa de reembolso",
  );
  publicarResumenAdmin();

  const mensajeRechazo = retencionLiberada
    ? "Disputa rechazada: se retiró la retención preventiva y la venta continúa su flujo normal"
    : "Disputa rechazada: la retención preventiva continúa por otros reportes o disputas sobre la venta";

  return {
    message: reembolsada
      ? `Disputa resuelta: se reembolsó $${monto.toFixed(2)} al comprador${adeudoId ? " y se registró el adeudo correspondiente al vendedor" : ""}`
      : mensajeRechazo,
    dictamen: reembolsada ? "reembolsar" : "rechazar",
    disputa: serializarDisputa(disputa, {
      vendedorNombre: contactoVendedor?.nombre ?? "",
      ventaEstado: String(venta.estado),
    }),
    reembolsada,
    adeudoId,
    retencionLiberada,
  };
}

async function cargarVentaFlexible(idVenta: unknown): Promise<VentaEscrow | null> {
  const texto = String(idVenta ?? "").trim();

  if (/^\d+$/.test(texto)) {
    return cargarVenta(Number(texto));
  }

  if (mongoose.isValidObjectId(texto)) {
    const espejo = await Venta.findById(texto)
      .select("ventaIdPg paypalOrderId")
      .lean();
    if (espejo?.ventaIdPg) {
      return cargarVenta(Number(espejo.ventaIdPg));
    }
    if (espejo?.paypalOrderId) {
      const enPg = await clientePrisma.venta.findFirst({
        where: { paypalOrderId: String(espejo.paypalOrderId) },
      });
      return (enPg as VentaEscrow | null) ?? null;
    }
  }

  return null;
}

export async function resolverVentaRetenidaAdmin(
  idVenta: unknown,
  opciones: {
    dictamen?: unknown;
    causaAdeudo?: unknown;
    nota?: string;
    adminId?: number | null;
  } = {},
): Promise<{
  message: string;
  ventaId: number;
  reembolsada: boolean;
  retencionLiberada: boolean;
  adeudoId?: string;
}> {
  if (opciones.dictamen !== "reembolsar" && opciones.dictamen !== "liberar") {
    throw new ErrorBackoffice(
      400,
      "El dictamen debe ser reembolsar o liberar",
    );
  }

  const venta = await cargarVentaFlexible(idVenta);
  if (!venta) {
    throw new ErrorBackoffice(404, "Venta no encontrada");
  }
  if (!venta.retenido) {
    throw new ErrorBackoffice(
      400,
      "Esta venta no tiene una retención pendiente de resolver",
    );
  }

  const disputasAbiertas = await Disputa.countDocuments({
    ventaIdPg: venta.id,
    estado: "abierta",
  });
  if (disputasAbiertas > 0) {
    throw new ErrorBackoffice(
      400,
      "Esta venta tiene una disputa abierta: resuélvela desde la sección de disputas",
    );
  }

  const nota = (opciones.nota ?? "").trim();

  if (opciones.dictamen === "liberar") {
    await clientePrisma.venta.update({
      where: { id: venta.id },
      data: { retenido: false },
    });
    await actualizarEspejoVenta(venta.paypalOrderId, { retenido: false });

    await publicarDisputasActualizadas(
      "retencion_liberada",
      `Se retiró la retención preventiva de la venta ${venta.id} por revisión administrativa`,
    );
    publicarResumenAdmin();

    return {
      message:
        "Retención retirada: la venta continúa su flujo normal del escrow",
      ventaId: venta.id,
      reembolsada: false,
      retencionLiberada: true,
    };
  }

  const causa = CAUSAS_ADEUDO.includes(opciones.causaAdeudo as CausaAdeudo)
    ? (opciones.causaAdeudo as CausaAdeudo)
    : null;

  const resultado = await cancelarEscrow(venta, {
    motivo: `Revisión administrativa de una venta retenida: se aprobó el reembolso al comprador${
      nota ? ` (${nota})` : ""
    }`,
    resolverRetencion: true,
    ...(causa ? { culpaVendedor: { causa } } : {}),
  });

  if (resultado.error) {
    throw new ErrorBackoffice(502, resultado.error);
  }

  await publicarDisputasActualizadas(
    "retencion_liberada",
    `Se reembolsó la venta retenida ${venta.id} por revisión administrativa${
      resultado.adeudoId ? " y se registró el adeudo del vendedor" : ""
    }`,
  );
  publicarResumenAdmin();

  return {
    message: `Reembolso procesado para la venta ${venta.id}${
      resultado.adeudoId
        ? "; se registró el adeudo correspondiente al vendedor"
        : ""
    }`,
    ventaId: venta.id,
    reembolsada: true,
    retencionLiberada: true,
    adeudoId: resultado.adeudoId,
  };
}

export async function listarDisputasAdmin(
  opciones: { pagina?: number; porPagina?: number; estado?: string } = {},
): Promise<ListadoDisputas> {
  const pagina = Math.max(Number(opciones.pagina) || 1, 1);
  const porPagina = Math.max(
    Number(opciones.porPagina) || DISPUTAS_POR_PAGINA,
    1,
  );

  const filtro: Record<string, unknown> = {};
  if (["abierta", "reembolsada", "rechazada"].includes(String(opciones.estado))) {
    filtro.estado = opciones.estado;
  }

  const [disputas, total, abiertas, ventasPg] = await Promise.all([
    Disputa.find(filtro)
      .sort({ createdAt: -1 })
      .skip((pagina - 1) * porPagina)
      .limit(porPagina)
      .lean(),
    Disputa.countDocuments(filtro),
    Disputa.countDocuments({ estado: "abierta" }),
    clientePrisma.venta.findMany({ where: {} }),
  ]);

  const ventas = ventasPg as VentaEscrow[];
  const estadosPorVenta = new Map<number, string>();
  for (const venta of ventas) {
    estadosPorVenta.set(Number(venta.id), String(venta.estado));
  }

  const retenidas = ventas.filter((venta) => venta.retenido);

  const idsVendedor = [
    ...new Set([
      ...disputas.map((disputa) => Number(disputa.vendedorId)),
      ...retenidas.map((venta) => Number(venta.vendedorId)),
    ]),
  ];
  const nombres = new Map<number, string>();
  for (const id of idsVendedor) {
    const contacto = await contactoDelVendedor(id);
    nombres.set(id, contacto?.nombre || `Vendedor #${id}`);
  }

  const ventasRetenidas: VentaRetenidaSerializada[] = [];
  for (const venta of retenidas) {
    const producto = /^[0-9a-fA-F]{24}$/.test(venta.productoId)
      ? await Producto.findById(venta.productoId).select("nombre").lean()
      : null;
    const espejo = await Venta.findOne({ paypalOrderId: venta.paypalOrderId })
      .select("_id")
      .lean();
    const [disputaAbierta, reportes] = await Promise.all([
      Disputa.countDocuments({ ventaIdPg: Number(venta.id), estado: "abierta" }),
      clientePrisma.reporte.findMany({ where: { ventaId: String(venta.id) } }),
    ]);

    ventasRetenidas.push({
      ventaId: Number(venta.id),
      ventaMongoId: espejo?._id ? String(espejo._id) : null,
      estado: String(venta.estado),
      monto: Number(venta.monto),
      productoNombre: producto?.nombre ?? "Producto no encontrado",
      compradorId: String(venta.compradorId),
      vendedorId: Number(venta.vendedorId),
      vendedorNombre:
        nombres.get(Number(venta.vendedorId)) ??
        `Vendedor #${venta.vendedorId}`,
      canceladoMotivo: venta.canceladoMotivo ?? null,
      tieneDisputaAbierta: disputaAbierta > 0,
      reportesPendientes: reportes.filter(
        (reporte) => String(reporte.estado) === "pendiente",
      ).length,
      reportesConfirmados: reportes.filter(
        (reporte) => String(reporte.estado) === "confirmado",
      ).length,
      fecha: venta.createdAt ?? new Date(),
    });
  }

  return {
    disputas: disputas.map((disputa) =>
      serializarDisputa(disputa, {
        vendedorNombre:
          nombres.get(Number(disputa.vendedorId)) ??
          `Vendedor #${disputa.vendedorId}`,
        ventaEstado: estadosPorVenta.get(Number(disputa.ventaIdPg)) ?? null,
      }),
    ),
    ventasRetenidas,
    abiertas,
    pagina,
    porPagina,
    total,
    totalPaginas: Math.max(Math.ceil(total / porPagina), 1),
  };
}
