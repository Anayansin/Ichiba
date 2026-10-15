import mongoose from "mongoose";
import clientePrisma from "../configuracion/prisma.js";
import { Cola } from "../models/Cola.js";
import { Mensaje } from "../models/Mensaje.js";
import { Reporte } from "../models/Reporte.js";
import { Venta } from "../models/Venta.js";
import { Usuario } from "../models/usuario.js";
import { ListaNegra } from "../models/ListaNegra.js";
import { puntosDeCategoria } from "../configuracion/categoriasReporte.js";
import {
  acumularPuntosDeReporte,
  PUNTOS_CANCELACION,
} from "./cancelacionCuentaService.js";
import {
  agregarAListaNegra,
  resumirEntrada,
  type EntradaListaNegra,
} from "./listaNegraService.js";
import {
  calcularResumenAdmin,
  resumirUsuario,
  type ResumenAdminSerializado,
  type UsuarioResumido,
} from "./resumenAdminService.js";
import { levantarSancionPorAdmin, quitarFalta } from "./sancionService.js";
import { ErrorBackoffice } from "./errorBackoffice.js";
import {
  listarAdeudosAdmin as listarAdeudosDelServicio,
  liquidarAdeudoAdmin as liquidarAdeudoDelServicio,
} from "./adeudoService.js";
import {
  liberarRetencionSiCorresponde,
  listarDisputasAdmin as listarDisputasDelServicio,
  resolverDisputaAdmin as resolverDisputaDelServicio,
  resolverVentaRetenidaAdmin as resolverVentaRetenidaDelServicio,
} from "./disputaService.js";
import {
  publicarEventoUsuario,
  publicarListaNegraActualizada,
  publicarReportesPendientes,
  publicarResumenAdmin,
} from "../graphql/suscripciones.js";

/**
 * Operaciones del BackOffice del administrador.
 *
 * Vive en un servicio (y no en el controlador) porque las consumen tres
 * entradas distintas: los endpoints REST `/api/admin/*`, el servidor MCP
 * (`src/mcp`) y las suscripciones GraphQL de la Fase 4. Así las reglas de
 * negocio, los eventos publicados y los formatos de respuesta son idénticos
 * en todas.
 *
 * Los errores esperados (validaciones y «no encontrado») se lanzan como
 * `ErrorBackoffice` con el código HTTP que le corresponde; los controladores
 * REST lo traducen a `res.status`, y las herramientas MCP a un mensaje de
 * error legible.
 */

export { ErrorBackoffice };

export const USUARIOS_POR_PAGINA = 10;
export const ENTRADAS_POR_PAGINA = 20;
export const LIMITE_HISTORIAL = 100;

// ---------------------------------------------------------------------------
// Dashboard (RQF36)
// ---------------------------------------------------------------------------

export async function obtenerResumenAdmin(): Promise<ResumenAdminSerializado> {
  return calcularResumenAdmin();
}

// ---------------------------------------------------------------------------
// Usuarios (RQF36)
// ---------------------------------------------------------------------------

export type ListadoUsuarios = {
  usuarios: UsuarioResumido[];
  pagina: number;
  porPagina: number;
  total: number;
  totalPaginas: number;
};

export async function listarUsuariosAdmin(opciones: {
  pagina?: number;
  porPagina?: number;
  /** Texto libre que filtra por nombre o correo (lo usa el MCP). */
  busqueda?: string;
}): Promise<ListadoUsuarios> {
  const pagina = Math.max(Number(opciones.pagina) || 1, 1);
  const porPagina = Math.max(
    Number(opciones.porPagina) || USUARIOS_POR_PAGINA,
    1,
  );
  const busqueda = (opciones.busqueda ?? "").trim();

  const filtro = busqueda
    ? {
        $or: [
          { nombreCompleto: { $regex: busqueda, $options: "i" } },
          { correo: { $regex: busqueda, $options: "i" } },
        ],
      }
    : {};

  const [usuarios, total] = await Promise.all([
    Usuario.find(filtro)
      .select(
        "nombreCompleto correo tipo suspendido puntosReputacion estadoCuenta createdAt motivoSuspension saldoPendiente sancionHasta sancionPermanente revisionAdministrativa",
      )
      .sort({ createdAt: -1 })
      .skip((pagina - 1) * porPagina)
      .limit(porPagina)
      .lean(),
    Usuario.countDocuments(filtro),
  ]);

  return {
    usuarios: usuarios.map(resumirUsuario),
    pagina,
    porPagina,
    total,
    totalPaginas: Math.max(Math.ceil(total / porPagina), 1),
  };
}

export async function cambiarSuspensionUsuarioAdmin(
  id: string,
  suspendido: boolean,
  motivo?: string,
): Promise<UsuarioResumido> {
  if (!id || !mongoose.isValidObjectId(id)) {
    throw new ErrorBackoffice(400, "Indica el usuario que quieres modificar");
  }

  // RQNF10.3 / RQF12: la cancelación por 8 puntos es permanente; no se
  // suspende ni se reactiva manualmente.
  const existente = await Usuario.findById(id)
    .select("estadoCuenta saldoPendiente")
    .lean();
  if (existente && existente.estadoCuenta === "cancelada") {
    throw new ErrorBackoffice(
      400,
      "La cuenta fue cancelada de forma permanente por acumular 8 puntos (RQNF10.3)",
    );
  }

  // RQNF38: la reactivación queda bloqueada mientras exista un adeudo
  // pendiente; primero el administrador debe registrar la liquidación total.
  if (!suspendido) {
    const saldo = Number(existente?.saldoPendiente ?? 0);
    if (saldo > 0) {
      throw new ErrorBackoffice(
        400,
        `No se puede reactivar: la cuenta tiene un saldo pendiente de $${saldo.toFixed(
          2,
        )}. Registra la liquidación total del adeudo antes de reactivarla (RQNF38).`,
      );
    }
  }

  const motivoFinal = (motivo ?? "").trim();
  const usuario = await Usuario.findByIdAndUpdate(
    id,
    {
      suspendido,
      motivoSuspension: suspendido
        ? motivoFinal || "manual"
        : null,
    },
    { new: true },
  );

  if (!usuario) {
    throw new ErrorBackoffice(404, "Usuario no encontrado");
  }

  // RQNF33 / RQNF35: al reactivar se levanta la sanción vigente (incluida la
  // revisión administrativa) para que la cuenta vuelva a operar.
  if (!suspendido && Number.isInteger(Number(usuario.usuarioId))) {
    try {
      await levantarSancionPorAdmin(
        "usuario",
        String(usuario.usuarioId),
        "La administración reactivó la cuenta.",
      );
    } catch (error) {
      console.error(
        "[backoffice] No se pudo levantar la sanción al reactivar:",
        error instanceof Error ? error.message : error,
      );
    }
  }

  // Fase 4: el BackOffice recibe el cambio al instante por suscripción.
  await publicarEventoUsuario(
    suspendido ? "suspendido" : "reactivado",
    suspendido
      ? `Usuario suspendido: ${usuario.nombreCompleto}`
      : `Usuario reactivado: ${usuario.nombreCompleto}`,
    resumirUsuario(usuario),
  );
  publicarResumenAdmin();

  return resumirUsuario(usuario);
}

// ---------------------------------------------------------------------------
// Reportes (RQF37)
// ---------------------------------------------------------------------------

export type ReportePendienteSerializado = {
  id: number;
  categoria: string;
  categoriaNombre: string;
  elemento: string;
  tipoFalta: string;
  detalle: string | null;
  estado: string;
  sujetoTipo: string;
  reportadoPorTipo: string;
  vendedorNombre: string;
  puntos: number;
  puntosReputacion: number;
  puntosCancelacion: number;
  estadoCuenta: string;
  fecha: Date | string;
};

export async function listarReportesPendientesAdmin(): Promise<
  ReportePendienteSerializado[]
> {
  const reportes = await clientePrisma.reporte.findMany({
    where: { estado: "pendiente" },
    orderBy: { createdAt: "desc" },
  });

  const vendedores: Record<
    string,
    { nombre: string; puntosReputacion: number; estadoCuenta: string }
  > = {};
  for (const reporte of reportes) {
    const idVendedor = String(reporte.vendedorId);
    if (vendedores[idVendedor]) continue;

    const vendedor = await clientePrisma.usuario.findUnique({
      where: { id: Number(reporte.vendedorId) },
      select: {
        nombreCompleto: true,
        puntosReputacion: true,
        estadoCuenta: true,
      },
    });
    vendedores[idVendedor] = vendedor
      ? {
          nombre: vendedor.nombreCompleto,
          puntosReputacion: Number(vendedor.puntosReputacion ?? 0),
          estadoCuenta: vendedor.estadoCuenta ?? "activa",
        }
      : {
          nombre: "Vendedor no encontrado",
          puntosReputacion: 0,
          estadoCuenta: "activa",
        };
  }

  return reportes.map((reporte) => {
    const vendedor = vendedores[String(reporte.vendedorId)];
    return {
      id: reporte.id,
      categoria: reporte.categoria,
      categoriaNombre: reporte.categoriaNombre,
      elemento: reporte.elemento,
      tipoFalta: reporte.tipoFalta,
      detalle: reporte.detalle ?? null,
      estado: reporte.estado,
      sujetoTipo: reporte.sujetoTipo,
      reportadoPorTipo: reporte.reportadoPorTipo,
      vendedorNombre: vendedor.nombre,
      // RQNF10.1 / RQNF10.3: cuántos puntos suma el reporte al
      // confirmarse y cuántos lleva acumulados el vendedor (8 = cancelación).
      puntos: puntosDeCategoria(reporte.categoria, reporte.tipoFalta),
      puntosReputacion: vendedor.puntosReputacion,
      puntosCancelacion: PUNTOS_CANCELACION,
      estadoCuenta: vendedor.estadoCuenta,
      fecha: reporte.createdAt,
    };
  });
}

/**
 * Suma una falta leve confirmada al vendedor; cada 3 faltas se convierte en
 * una falta grave registrada (incremento de `totalReportes`).
 */
export async function aplicarFaltaConfirmada(
  idVendedor: number,
  faltasActuales: number,
) {
  const faltasAcumuladas = faltasActuales + 1;
  const alcanzoMultiploDeTres = faltasAcumuladas % 3 === 0;

  await clientePrisma.usuario.update({
    where: { id: idVendedor },
    data: {
      faltasLeves: alcanzoMultiploDeTres ? 0 : faltasAcumuladas,
      totalReportes: alcanzoMultiploDeTres ? { increment: 1 } : undefined,
    },
  });

  return {
    faltasLeves: alcanzoMultiploDeTres ? 0 : faltasAcumuladas,
    faltaGraveRegistrada: alcanzoMultiploDeTres,
  };
}

export type ResolucionReporte = {
  message: string;
  estado: "confirmado" | "rechazado";
  faltasLeves?: number;
  faltaGraveRegistrada?: boolean;
  puntos?: number;
  puntosReputacion?: number;
  cuentaCancelada?: boolean;
};

export async function resolverReporteAdmin(
  idReporte: unknown,
  resultado: unknown,
): Promise<ResolucionReporte> {
  if (!idReporte || isNaN(Number(idReporte))) {
    throw new ErrorBackoffice(400, "Indica el reporte que quieres resolver");
  }

  if (resultado !== "confirmado" && resultado !== "rechazado") {
    throw new ErrorBackoffice(400, "El resultado debe ser confirmado o rechazado");
  }

  const reporte = await clientePrisma.reporte.findUnique({
    where: { id: Number(idReporte) },
  });

  if (!reporte) {
    throw new ErrorBackoffice(404, "Reporte no encontrado");
  }

  if (reporte.estado !== "pendiente") {
    throw new ErrorBackoffice(400, "Este reporte ya fue resuelto");
  }

  if (resultado === "rechazado") {
    await clientePrisma.reporte.update({
      where: { id: reporte.id },
      data: { estado: "rechazado" },
    });

    // RQNF33: el reporte rechazado revierte la falta y el bloqueo automático
    // que había generado al crearse.
    try {
      await quitarFalta(String(reporte.id));
    } catch (error) {
      console.error(
        "[backoffice] No se pudo revertir la falta del reporte rechazado:",
        error instanceof Error ? error.message : error,
      );
    }

    // RQNF32: si el reporte era lo único que retenía el pago de la venta
    // (sin disputas abiertas ni otros reportes vivos), se retira la
    // retención preventiva.
    const ventaIdPg = Number(reporte.ventaId);
    if (Number.isInteger(ventaIdPg)) {
      try {
        await liberarRetencionSiCorresponde(ventaIdPg);
      } catch (error) {
        console.error(
          "[backoffice] No se pudo revisar la retención de la venta del reporte rechazado:",
          error instanceof Error ? error.message : error,
        );
      }
    }

    // Fase 4: el BackOffice actualiza la bandeja de reportes al instante.
    await publicarReportesPendientes(
      "rechazado",
      "Se rechazó un reporte de la bandeja",
    );
    publicarResumenAdmin();

    return { message: "Reporte rechazado", estado: "rechazado" };
  }

  const sujetoEsVendedor =
    reporte.tipoReportado === "vendedor" || reporte.sujetoTipo === "usuario";
  const idVendedorAcusado = Number(reporte.sujetoId);
  let vendedor: { faltasLeves: number } | null = null;

  if (sujetoEsVendedor) {
    if (!Number.isFinite(idVendedorAcusado)) {
      throw new ErrorBackoffice(400, "El vendedor de este reporte no es válido");
    }

    vendedor = await clientePrisma.usuario.findUnique({
      where: { id: idVendedorAcusado },
    });

    if (!vendedor) {
      throw new ErrorBackoffice(404, "Vendedor no encontrado");
    }
  }

  await clientePrisma.reporte.update({
    where: { id: reporte.id },
    data: { estado: "confirmado" },
  });

  if (!vendedor) {
    // Fase 4: aunque el sujeto no sea vendedor, la bandeja cambió.
    await publicarReportesPendientes(
      "resuelto",
      "Se confirmó un reporte de la bandeja",
    );
    publicarResumenAdmin();

    return {
      message: "Reporte confirmado correctamente",
      estado: "confirmado",
    };
  }

  const faltas = await aplicarFaltaConfirmada(
    idVendedorAcusado,
    vendedor.faltasLeves,
  );

  // RQNF10.1 / RQNF10.3: los puntos del reporte se suman a la reputación al
  // confirmarse y, al llegar a 8, la cuenta se cancela de forma permanente
  // con correo al vendedor, lista negra, publicaciones fuera y purga
  // posterior (RQNF10.5 / RQNF10.6 / RQNF10.7).
  const resultadoPuntos = await acumularPuntosDeReporte(
    idVendedorAcusado,
    reporte.categoria,
    reporte.tipoFalta,
  );

  // Fase 4: la bandeja de reportes y el dashboard se refrescan al instante
  // (los puntos del vendedor los publica `acumularPuntosDeReporte`).
  await publicarReportesPendientes(
    "resuelto",
    "Se confirmó un reporte de la bandeja",
  );
  publicarResumenAdmin();

  return {
    message: resultadoPuntos.cancelacion
      ? `Reporte confirmado: el vendedor alcanzó ${PUNTOS_CANCELACION} puntos y su cuenta fue cancelada de forma permanente`
      : "Reporte confirmado correctamente",
    estado: "confirmado",
    faltasLeves: faltas.faltasLeves,
    faltaGraveRegistrada: faltas.faltaGraveRegistrada,
    puntos: resultadoPuntos.puntos,
    puntosReputacion: resultadoPuntos.puntosReputacion,
    cuentaCancelada: Boolean(resultadoPuntos.cancelacion),
  };
}

// ---------------------------------------------------------------------------
// Disputas y ventas retenidas (RQF40 / RQNF32)
// ---------------------------------------------------------------------------

/**
 * RQF40: bandeja de disputas del BackOffice más las ventas con retención
 * preventiva pendientes de resolver. La lógica vive en `disputaService` y se
 * delega aquí para que la compartan REST, MCP y GraphQL.
 */
export async function listarDisputasAdmin(opciones: {
  pagina?: number;
  porPagina?: number;
  estado?: string;
}) {
  return listarDisputasDelServicio(opciones);
}

/** RQF40: dictamen del administrador sobre una disputa (reembolsar/rechazar). */
export async function resolverDisputaAdmin(
  id: unknown,
  dictamen: unknown,
  opciones: { nota?: string; adminId?: number | null } = {},
) {
  return resolverDisputaDelServicio(id, dictamen, opciones);
}

/** RQF40 / RQNF32: resuelve una venta retenida (reembolsar o liberar). */
export async function resolverVentaRetenidaAdmin(
  idVenta: unknown,
  opciones: {
    dictamen?: unknown;
    causaAdeudo?: unknown;
    nota?: string;
    adminId?: number | null;
  } = {},
) {
  return resolverVentaRetenidaDelServicio(idVenta, opciones);
}

// ---------------------------------------------------------------------------
// Adeudos del vendedor (RQNF37 / RQNF38)
// ---------------------------------------------------------------------------

/** RQNF37: listado paginado de adeudos con el total pendiente de liquidar. */
export async function listarAdeudosAdmin(opciones: {
  pagina?: number;
  porPagina?: number;
  estado?: string;
  usuarioId?: number;
}) {
  return listarAdeudosDelServicio(opciones);
}

/** RQNF38: registra la liquidación de un adeudo (pago por transferencia). */
export async function liquidarAdeudoAdmin(
  id: unknown,
  opciones: { nota?: string; adminId?: number | null } = {},
) {
  return liquidarAdeudoDelServicio(id, opciones);
}

// ---------------------------------------------------------------------------
// Historial de transacciones (RQF38)
// ---------------------------------------------------------------------------

export type EntradaHistorial = {
  id: string;
  tipo: "fila" | "venta" | "reporte";
  fecha: Date;
  estado: string;
  productoNombre: string;
  vendedorNombre: string;
  monto: number | null;
  detalle: string;
};

const PRODUCTO_INEXISTENTE = "Producto no encontrado";
const VENDEDOR_INEXISTENTE = "Vendedor no encontrado";

function resolverProducto(...candidatos: unknown[]) {
  for (const candidato of candidatos) {
    const producto = candidato as { nombre?: string; vendedor?: string } | null;
    if (!producto?.nombre) continue;

    return {
      nombre: producto.nombre,
      vendedor: producto.vendedor ?? VENDEDOR_INEXISTENTE,
    };
  }

  return { nombre: PRODUCTO_INEXISTENTE, vendedor: VENDEDOR_INEXISTENTE };
}

function fechaDeDocumento(createdAt?: Date | string) {
  return createdAt ? new Date(createdAt) : new Date(0);
}

function entradaDeCola(cola: unknown): EntradaHistorial {
  const datos = cola as {
    _id: unknown;
    createdAt?: Date | string;
    posicion?: number;
    estado?: string;
    productoId?: unknown;
  };
  const producto = resolverProducto(datos.productoId);

  return {
    id: String(datos._id),
    tipo: "fila",
    fecha: fechaDeDocumento(datos.createdAt),
    estado: datos.estado ?? "activa",
    productoNombre: producto.nombre,
    vendedorNombre: producto.vendedor,
    monto: null,
    detalle: `Posición ${datos.posicion ?? "-"}`,
  };
}

function entradaDeVenta(venta: unknown): EntradaHistorial {
  const datos = venta as {
    _id: unknown;
    createdAt?: Date | string;
    estado?: string;
    monto?: number;
    paypalOrderId?: string;
    productoId?: unknown;
  };
  const producto = resolverProducto(datos.productoId);

  return {
    id: String(datos._id),
    tipo: "venta",
    fecha: fechaDeDocumento(datos.createdAt),
    estado: datos.estado ?? "completada",
    productoNombre: producto.nombre,
    vendedorNombre: producto.vendedor,
    monto: typeof datos.monto === "number" ? datos.monto : null,
    detalle: datos.paypalOrderId
      ? `Referencia ${datos.paypalOrderId}`
      : "Sin referencia",
  };
}

function entradaDeReporte(reporte: unknown): EntradaHistorial {
  const datos = reporte as {
    _id: unknown;
    createdAt?: Date | string;
    estado?: string;
    categoria?: string;
    categoriaNombre?: string;
    tipoFalta?: string;
    productoId?: unknown;
    ventaId?: unknown;
  };
  const venta = datos.ventaId as { productoId?: unknown } | null | undefined;
  const producto = resolverProducto(datos.productoId, venta?.productoId);
  const categoria =
    datos.categoriaNombre ?? datos.categoria ?? "Reporte sin categoría";

  return {
    id: String(datos._id),
    tipo: "reporte",
    fecha: fechaDeDocumento(datos.createdAt),
    estado: datos.estado ?? "pendiente",
    productoNombre: producto.nombre,
    vendedorNombre: producto.vendedor,
    monto: null,
    detalle: datos.tipoFalta
      ? `${categoria} (falta ${datos.tipoFalta})`
      : categoria,
  };
}

export async function historialTransaccionesAdmin(): Promise<
  EntradaHistorial[]
> {
  const [colas, ventas, reportes] = await Promise.all([
    Cola.find()
      .sort({ createdAt: -1 })
      .limit(LIMITE_HISTORIAL)
      .populate("productoId", "nombre vendedor"),
    Venta.find()
      .sort({ createdAt: -1 })
      .limit(LIMITE_HISTORIAL)
      .populate("productoId", "nombre vendedor"),
    Reporte.find()
      .sort({ createdAt: -1 })
      .limit(LIMITE_HISTORIAL)
      .populate("productoId", "nombre vendedor")
      .populate({
        path: "ventaId",
        select: "productoId",
        populate: { path: "productoId", select: "nombre vendedor" },
      }),
  ]);

  const historial: EntradaHistorial[] = [
    ...colas.map(entradaDeCola),
    ...ventas.map(entradaDeVenta),
    ...reportes.map(entradaDeReporte),
  ];

  historial.sort((a, b) => b.fecha.getTime() - a.fecha.getTime());

  return historial;
}

// ---------------------------------------------------------------------------
// Auditoría del chat (RQF39)
// ---------------------------------------------------------------------------

export async function mensajesDeVentaAdmin(ventaId: string) {
  if (!ventaId || !mongoose.isValidObjectId(ventaId)) {
    throw new ErrorBackoffice(400, "Indica la venta de la conversación");
  }

  const venta = await Venta.findById(ventaId);
  if (!venta) {
    throw new ErrorBackoffice(404, "Venta no encontrada");
  }

  return Mensaje.find({ ventaId }).sort({ createdAt: 1 });
}

// ---------------------------------------------------------------------------
// Lista negra (RQNF1.9 / RQNF36)
// ---------------------------------------------------------------------------

export type ListadoListaNegra = {
  entradas: EntradaListaNegra[];
  pagina: number;
  porPagina: number;
  total: number;
  totalPaginas: number;
};

export async function listarListaNegraAdmin(opciones: {
  pagina?: number;
  porPagina?: number;
}): Promise<ListadoListaNegra> {
  const pagina = Math.max(Number(opciones.pagina) || 1, 1);
  const porPagina = Math.max(
    Number(opciones.porPagina) || ENTRADAS_POR_PAGINA,
    1,
  );

  const [entradas, total] = await Promise.all([
    ListaNegra.find()
      .sort({ createdAt: -1 })
      .skip((pagina - 1) * porPagina)
      .limit(porPagina)
      .lean(),
    ListaNegra.countDocuments(),
  ]);

  return {
    entradas: entradas.map(resumirEntrada),
    pagina,
    porPagina,
    total,
    totalPaginas: Math.max(Math.ceil(total / porPagina), 1),
  };
}

export async function agregarEntradaListaNegraAdmin(datos: {
  rfc?: string;
  curp?: string;
  ineCodigoReverso?: string;
  correo?: string;
  nombreCompleto?: string;
  motivo?: string;
}): Promise<EntradaListaNegra> {
  const { rfc, curp, ineCodigoReverso, correo, nombreCompleto, motivo } = datos;

  if (!motivo || typeof motivo !== "string" || !motivo.trim()) {
    throw new ErrorBackoffice(
      400,
      "Indica el motivo por el que se agrega a la lista negra",
    );
  }

  const hayIdentificacion = Boolean(
    (rfc && rfc.trim()) || (curp && curp.trim()),
  );
  if (!hayIdentificacion) {
    throw new ErrorBackoffice(400, "Indica al menos el RFC o la CURP de la persona");
  }

  let entrada: EntradaListaNegra;
  try {
    entrada = await agregarAListaNegra({
      rfc,
      curp,
      ineCodigoReverso,
      correo,
      nombreCompleto,
      motivo,
      origen: "manual",
    });
  } catch (error: unknown) {
    const duplicado =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: number }).code === 11000;

    if (duplicado) {
      throw new ErrorBackoffice(409, "Ese RFC o CURP ya está en la lista negra");
    }
    throw error;
  }

  // Fase 4: la lista negra del BackOffice se actualiza al instante.
  await publicarListaNegraActualizada(
    "agregada",
    `Registro agregado a la lista negra: ${entrada.rfc || entrada.curp || entrada.nombreCompleto}`,
  );
  publicarResumenAdmin();

  return entrada;
}

export async function quitarEntradaListaNegraAdmin(id: string): Promise<void> {
  if (!id || !mongoose.isValidObjectId(id)) {
    throw new ErrorBackoffice(400, "Indica el registro que quieres quitar");
  }

  const borrada = await ListaNegra.findByIdAndDelete(id);

  if (!borrada) {
    throw new ErrorBackoffice(404, "Registro de lista negra no encontrado");
  }

  // Fase 4: la lista negra del BackOffice se actualiza al instante.
  await publicarListaNegraActualizada(
    "quitada",
    `Registro quitado de la lista negra: ${borrada.rfc || borrada.curp || borrada.nombreCompleto}`,
  );
  publicarResumenAdmin();
}
