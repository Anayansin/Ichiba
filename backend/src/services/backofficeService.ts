import mongoose from "mongoose";
import clientePrisma from "../configuracion/prisma.js";
import { Mensaje } from "../models/Mensaje.js";
import { Venta } from "../models/Venta.js";
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
  listarSolicitudesDeRevision,
  resolverSolicitudDeRevision,
  type ListadoSolicitudesRegistro,
  type SolicitudRevisionRegistro,
} from "./bloqueoRegistroService.js";
import { enviarCorreoRespuestaSolicitudRegistro } from "./emailService.js";
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
  publicarSolicitudRevisionRegistrada,
} from "../graphql/suscripciones.js";

export { ErrorBackoffice };

export const USUARIOS_POR_PAGINA = 10;
export const ENTRADAS_POR_PAGINA = 20;
export const LIMITE_HISTORIAL = 100;

export async function obtenerResumenAdmin(): Promise<ResumenAdminSerializado> {
  return calcularResumenAdmin();
}

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
  busqueda?: string;
}): Promise<ListadoUsuarios> {
  const pagina = Math.max(Number(opciones.pagina) || 1, 1);
  const porPagina = Math.max(
    Number(opciones.porPagina) || USUARIOS_POR_PAGINA,
    1,
  );
  const busqueda = (opciones.busqueda ?? "").trim();

  const todas = await clientePrisma.usuario.findMany({
    orderBy: { id: "desc" },
  });

  const filtradas = busqueda
    ? todas.filter(
        (cuenta) =>
          String(cuenta.nombreCompleto ?? "")
            .toLowerCase()
            .includes(busqueda.toLowerCase()) ||
          String(cuenta.correo ?? "")
            .toLowerCase()
            .includes(busqueda.toLowerCase()),
      )
    : todas;

  const total = filtradas.length;
  const usuarios = filtradas.slice(
    (pagina - 1) * porPagina,
    pagina * porPagina,
  );

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
  const idUsuario = Number(id);
  if (!Number.isInteger(idUsuario) || idUsuario <= 0) {
    throw new ErrorBackoffice(400, "Indica el usuario que quieres modificar");
  }

  const existente = await clientePrisma.usuario.findUnique({
    where: { id: idUsuario },
    select: { estadoCuenta: true, saldoPendiente: true },
  });
  if (existente && existente.estadoCuenta === "cancelada") {
    throw new ErrorBackoffice(
      400,
      "La cuenta fue cancelada de forma permanente por acumular 8 puntos (RQNF10.3)",
    );
  }

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
  const usuario = await clientePrisma.usuario.update({
    where: { id: idUsuario },
    data: {
      suspendido,
      motivoSuspension: suspendido ? motivoFinal || "manual" : null,
    },
  });

  if (!usuario) {
    throw new ErrorBackoffice(404, "Usuario no encontrado");
  }

  if (!suspendido) {
    try {
      await levantarSancionPorAdmin(
        "usuario",
        String(idUsuario),
        "La administración reactivó la cuenta.",
      );
    } catch (error) {
      console.error(
        "[backoffice] No se pudo levantar la sanción al reactivar:",
        error instanceof Error ? error.message : error,
      );
    }
  }

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
      puntos: puntosDeCategoria(reporte.categoria, reporte.tipoFalta),
      puntosReputacion: vendedor.puntosReputacion,
      puntosCancelacion: PUNTOS_CANCELACION,
      estadoCuenta: vendedor.estadoCuenta,
      fecha: reporte.createdAt,
    };
  });
}

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

    try {
      await quitarFalta(String(reporte.id));
    } catch (error) {
      console.error(
        "[backoffice] No se pudo revertir la falta del reporte rechazado:",
        error instanceof Error ? error.message : error,
      );
    }

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

  const resultadoPuntos = await acumularPuntosDeReporte(
    idVendedorAcusado,
    reporte.categoria,
    reporte.tipoFalta,
  );

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

export async function listarDisputasAdmin(opciones: {
  pagina?: number;
  porPagina?: number;
  estado?: string;
}) {
  return listarDisputasDelServicio(opciones);
}

export async function resolverDisputaAdmin(
  id: unknown,
  dictamen: unknown,
  opciones: { nota?: string; adminId?: number | null } = {},
) {
  return resolverDisputaDelServicio(id, dictamen, opciones);
}

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

export async function listarAdeudosAdmin(opciones: {
  pagina?: number;
  porPagina?: number;
  estado?: string;
  usuarioId?: number;
}) {
  return listarAdeudosDelServicio(opciones);
}

export async function liquidarAdeudoAdmin(
  id: unknown,
  opciones: { nota?: string; adminId?: number | null } = {},
) {
  return liquidarAdeudoDelServicio(id, opciones);
}

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

export async function historialTransaccionesAdmin(): Promise<
  EntradaHistorial[]
> {
  const [colas, ventas, reportes] = await Promise.all([
    clientePrisma.cola.findMany({
      orderBy: { createdAt: "desc" },
      limit: LIMITE_HISTORIAL,
    }),
    clientePrisma.venta.findMany({
      orderBy: { createdAt: "desc" },
      limit: LIMITE_HISTORIAL,
    }),
    clientePrisma.reporte.findMany({
      orderBy: { createdAt: "desc" },
      limit: LIMITE_HISTORIAL,
    }),
  ]);

  const historial: EntradaHistorial[] = [
    ...colas.map((fila) => {
      const producto = resolverProducto(fila.productoId);
      return {
        id: String(fila.id),
        tipo: "fila" as const,
        fecha: fechaDeDocumento(fila.createdAt),
        estado: fila.estado ?? "activa",
        productoNombre: producto.nombre,
        vendedorNombre: producto.vendedor,
        monto: null,
        detalle: `Posición ${fila.posicion ?? "-"}`,
      };
    }),
    ...ventas.map((venta) => {
      const producto = resolverProducto(venta.productoId);
      return {
        id: String(venta.id),
        tipo: "venta" as const,
        fecha: fechaDeDocumento(venta.createdAt),
        estado: venta.estado ?? "completada",
        productoNombre: venta.productoNombre ?? producto.nombre,
        vendedorNombre: producto.vendedor,
        monto: typeof venta.monto === "number" ? venta.monto : null,
        detalle: venta.paypalOrderId
          ? `Referencia ${venta.paypalOrderId}`
          : "Sin referencia",
      };
    }),
    ...reportes.map((reporte) => {
      const producto = resolverProducto(reporte.productoId);
      const categoria =
        reporte.categoriaNombre ?? reporte.categoria ?? "Reporte sin categoría";
      return {
        id: String(reporte.id),
        tipo: "reporte" as const,
        fecha: fechaDeDocumento(reporte.createdAt),
        estado: reporte.estado ?? "pendiente",
        productoNombre: producto.nombre,
        vendedorNombre: producto.vendedor,
        monto: null,
        detalle: reporte.tipoFalta
          ? `${categoria} (falta ${reporte.tipoFalta})`
          : categoria,
      };
    }),
  ];

  historial.sort((a, b) => b.fecha.getTime() - a.fecha.getTime());

  return historial;
}

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

export async function agregarUsuarioAListaNegraAdmin(
  id: string,
  motivo?: string,
): Promise<EntradaListaNegra> {
  const idUsuario = Number(id);
  if (!Number.isInteger(idUsuario) || idUsuario <= 0) {
    throw new ErrorBackoffice(400, "Indica el usuario que quieres bloquear");
  }

  const usuario = await clientePrisma.usuario.findUnique({
    where: { id: idUsuario },
    select: {
      nombreCompleto: true,
      correo: true,
      rfc: true,
      curp: true,
      ineCodigoReverso: true,
    },
  });

  if (!usuario) {
    throw new ErrorBackoffice(404, "Usuario no encontrado");
  }

  return agregarEntradaListaNegraAdmin({
    rfc: usuario.rfc,
    curp: usuario.curp ?? undefined,
    ineCodigoReverso: usuario.ineCodigoReverso ?? undefined,
    correo: usuario.correo,
    nombreCompleto: usuario.nombreCompleto,
    motivo:
      (motivo ?? "").trim() || "Agregado desde Gestión de usuarios",
  });
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

  await publicarListaNegraActualizada(
    "quitada",
    `Registro quitado de la lista negra: ${borrada.rfc || borrada.curp || borrada.nombreCompleto}`,
  );
  publicarResumenAdmin();
}

export async function listarSolicitudesRegistroAdmin(opciones: {
  pagina?: number;
  porPagina?: number;
  estado?: string;
}): Promise<ListadoSolicitudesRegistro> {
  return listarSolicitudesDeRevision(opciones);
}

export async function resolverSolicitudRegistroAdmin(
  id: string,
  datos: {
    estado: "en-revision" | "resuelta" | "descartada";
    respuesta?: string;
    revisadaPor?: string;
  },
): Promise<SolicitudRevisionRegistro> {
  if (!id || !mongoose.isValidObjectId(id)) {
    throw new ErrorBackoffice(400, "La solicitud no es válida");
  }

  const solicitud = await resolverSolicitudDeRevision(id, datos);

  if (!solicitud) {
    throw new ErrorBackoffice(404, "La solicitud no existe");
  }

  void enviarCorreoRespuestaSolicitudRegistro(solicitud).catch((error) => {
    console.error(
      "[backoffice] No se pudo enviar la respuesta de la solicitud:",
      error instanceof Error ? error.message : error,
    );
  });

  await publicarSolicitudRevisionRegistrada(solicitud, "revisada");

  return solicitud;
}
