import clientePrisma from "../configuracion/prisma.js";
import { ListaNegra } from "../models/ListaNegra.js";
import { Mensaje } from "../models/Mensaje.js";
import { Producto } from "../models/producto.js";
import { Promocional } from "../models/Promocional.js";
import { Usuario } from "../models/usuario.js";
import { relojZonaCentro } from "../utils/validarHorario.js";

/**
 * Dashboard del administrador: todas las cifras se calculan en el momento de
 * cada lectura (sin caché ni snapshots) leyendo las fuentes vivas de cada
 * módulo — usuarios, catálogo y mensajes en MongoDB; ventas, reportes y filas
 * en PostgreSQL.
 *
 * Vive en un servicio (y no en el controlador) porque lo usan tanto el
 * endpoint REST `GET /api/admin/resumen` como la suscripción GraphQL
 * `resumenAdmin` del BackOffice, que emite el resumen completo y fresco cada
 * vez que cambia algo relevante.
 */

export type UsuarioResumido = {
  id: string;
  nombreCompleto: string;
  correo: string;
  tipo: string;
  suspendido: boolean;
  /** RQNF10.1 / RQNF10.3: reputación por infracciones (8 = cancelación). */
  puntosReputacion: number;
  /** RQNF10.3 / RQF12: "activa" | "cancelada". */
  estadoCuenta: string;
  fechaRegistro: Date | null;
  /** RQNF37 / RQNF38: motivo de la suspensión administrativa (p. ej. saldo_pendiente). */
  motivoSuspension: string | null;
  /** RQNF37 / RQNF38: adeudo pendiente de liquidar (reembolsos por culpa del vendedor). */
  saldoPendiente: number;
  /** RQNF33 / RQNF34: fecha en que concluye el bloqueo temporal vigente. */
  sancionHasta: Date | null;
  /** RQNF34 / RQNF35: la sanción es indefinida. */
  sancionPermanente: boolean;
  /** RQNF35: la cuenta está en revisión administrativa. */
  revisionAdministrativa: boolean;
};

/** Igual que `UsuarioResumido` pero con las fechas en ISO (para GraphQL/JSON). */
export type UsuarioPublicado = Omit<
  UsuarioResumido,
  "fechaRegistro" | "sancionHasta"
> & {
  fechaRegistro: string | null;
  sancionHasta: string | null;
};

export function resumirUsuario(usuario: {
  _id: unknown;
  nombreCompleto?: string;
  correo?: string;
  tipo?: string;
  suspendido?: boolean;
  puntosReputacion?: number;
  estadoCuenta?: string;
  createdAt?: Date;
  motivoSuspension?: string | null;
  saldoPendiente?: number;
  sancionHasta?: Date | string | null;
  sancionPermanente?: boolean;
  revisionAdministrativa?: boolean;
}): UsuarioResumido {
  return {
    id: String(usuario._id),
    nombreCompleto: usuario.nombreCompleto ?? "",
    correo: usuario.correo ?? "",
    tipo: usuario.tipo ?? "",
    suspendido: usuario.suspendido === true,
    puntosReputacion: Number(usuario.puntosReputacion ?? 0),
    estadoCuenta: usuario.estadoCuenta ?? "activa",
    fechaRegistro: usuario.createdAt ?? null,
    motivoSuspension: usuario.motivoSuspension
      ? String(usuario.motivoSuspension)
      : null,
    saldoPendiente: Number(usuario.saldoPendiente ?? 0),
    sancionHasta: usuario.sancionHasta ? new Date(usuario.sancionHasta) : null,
    sancionPermanente: usuario.sancionPermanente === true,
    revisionAdministrativa: usuario.revisionAdministrativa === true,
  };
}

export function usuarioPublicado(usuario: UsuarioResumido): UsuarioPublicado {
  return {
    ...usuario,
    fechaRegistro: usuario.fechaRegistro
      ? new Date(usuario.fechaRegistro).toISOString()
      : null,
    sancionHasta: usuario.sancionHasta
      ? new Date(usuario.sancionHasta).toISOString()
      : null,
  };
}

export type ResumenAdminSerializado = {
  generadoEn: string;
  periodoMes: { desde: string };
  usuarios: {
    total: number;
    activos: number;
    suspendidos: number;
    administradores: number;
    nuevos30Dias: number;
    cancelados: number;
  };
  catalogo: {
    productos: { total: number; activos: number };
    promocionales: { total: number; activos: number };
  };
  ventas: {
    total: number;
    ingresos: number;
    mes: { total: number; ingresos: number };
    porEstado: { estado: string; total: number; ingresos: number }[];
    ultimas: {
      id: number;
      producto: string;
      vendedor: string;
      monto: number;
      estado: string;
      fecha: string;
    }[];
  };
  reportes: { pendientes: number; total: number };
  filas: { activas: number };
  mensajes: { total: number };
  listaNegra: { total: number };
  ultimosUsuarios: UsuarioPublicado[];
};

export async function calcularResumenAdmin(): Promise<ResumenAdminSerializado> {
  const ahora = new Date();
  const desde30Dias = new Date(ahora.getTime() - 30 * 24 * 60 * 60 * 1000);
  const centro = relojZonaCentro(ahora);
  const inicioMes = new Date(
    Date.UTC(centro.getFullYear(), centro.getMonth(), 1, 6),
  );

  const [
    usuariosTotal,
    usuariosActivos,
    usuariosSuspendidos,
    usuariosCancelados,
    usuariosAdministradores,
    usuariosNuevos30Dias,
    ultimosUsuarios,
    productosTotal,
    productosActivos,
    promocionalesTotal,
    promocionalesActivos,
    mensajesTotal,
    listaNegraTotal,
    ventasTodas,
    reportesPendientes,
    reportesTotal,
    filasActivas,
  ] = await Promise.all([
    Usuario.countDocuments(),
    Usuario.countDocuments({ suspendido: { $ne: true } }),
    Usuario.countDocuments({ suspendido: true }),
    // RQNF10.3: cuentas canceladas de forma permanente (8 puntos).
    clientePrisma.usuario.count({ where: { estadoCuenta: "cancelada" } }),
    Usuario.countDocuments({ tipo: "admin" }),
    Usuario.countDocuments({ createdAt: { $gte: desde30Dias } }),
    Usuario.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select(
        "nombreCompleto correo tipo suspendido puntosReputacion estadoCuenta createdAt motivoSuspension saldoPendiente sancionHasta sancionPermanente revisionAdministrativa",
      )
      .lean(),
    Producto.countDocuments(),
    Producto.countDocuments({ activo: true }),
    Promocional.countDocuments(),
    Promocional.countDocuments({ activo: true }),
    Mensaje.countDocuments(),
    ListaNegra.countDocuments(),
    // El cliente por contrato no expone agregados, límites de filas ni
    // operadores `gte`: se leen las ventas y sumas/filtros se calculan en
    // memoria sobre esa lectura.
    clientePrisma.venta.findMany({ orderBy: { createdAt: "desc" } }),
    clientePrisma.reporte.count({ where: { estado: "pendiente" } }),
    clientePrisma.reporte.count(),
    clientePrisma.cola.count({
      where: { estado: { in: ["activa", "esperando_confirmacion"] } },
    }),
  ]);

  // `createdAt` llega normalizado como Date; el filtro del mes (zona centro)
  // se hace en memoria porque el cliente no soporta comparaciones de fecha.
  const ventasDelMes = ventasTodas.filter((venta) => venta.createdAt >= inicioMes);
  const ingresosTotales = ventasTodas.reduce(
    (suma, venta) => suma + venta.monto,
    0,
  );
  const ingresosMes = ventasDelMes.reduce(
    (suma, venta) => suma + venta.monto,
    0,
  );

  const ventasPorEstado = new Map<string, { total: number; ingresos: number }>();
  for (const venta of ventasTodas) {
    const grupo = ventasPorEstado.get(venta.estado) ?? {
      total: 0,
      ingresos: 0,
    };
    grupo.total += 1;
    grupo.ingresos += venta.monto;
    ventasPorEstado.set(venta.estado, grupo);
  }

  const ultimasVentas = ventasTodas.slice(0, 6);

  // Nombres de los productos (MongoDB) y vendedores (PostgreSQL) que
  // aparecen en las últimas ventas.
  const productosUltimas = await Producto.find({
    _id: { $in: ultimasVentas.map((venta) => venta.productoId) },
  })
    .select("nombre")
    .lean();
  const nombrePorProducto = new Map(
    productosUltimas.map((producto) => [String(producto._id), producto.nombre]),
  );
  const vendedoresUltimas = new Map<number, string>();
  for (const venta of ultimasVentas) {
    if (vendedoresUltimas.has(venta.vendedorId)) continue;
    const vendedor = await clientePrisma.usuario.findUnique({
      where: { id: venta.vendedorId },
      select: { nombreCompleto: true },
    });
    vendedoresUltimas.set(
      venta.vendedorId,
      vendedor?.nombreCompleto ?? `#${venta.vendedorId}`,
    );
  }

  return {
    generadoEn: ahora.toISOString(),
    periodoMes: { desde: inicioMes.toISOString() },
    usuarios: {
      total: usuariosTotal,
      activos: usuariosActivos,
      suspendidos: usuariosSuspendidos,
      cancelados: usuariosCancelados,
      administradores: usuariosAdministradores,
      nuevos30Dias: usuariosNuevos30Dias,
    },
    catalogo: {
      productos: { total: productosTotal, activos: productosActivos },
      promocionales: { total: promocionalesTotal, activos: promocionalesActivos },
    },
    ventas: {
      total: ventasTodas.length,
      ingresos: ingresosTotales,
      mes: { total: ventasDelMes.length, ingresos: ingresosMes },
      porEstado: Array.from(ventasPorEstado.entries()).map(
        ([estado, grupo]) => ({
          estado,
          total: grupo.total,
          ingresos: grupo.ingresos,
        }),
      ),
      ultimas: ultimasVentas.map((venta) => ({
        id: venta.id,
        producto:
          nombrePorProducto.get(String(venta.productoId)) ?? venta.productoId,
        vendedor:
          vendedoresUltimas.get(venta.vendedorId) ?? `#${venta.vendedorId}`,
        monto: venta.monto,
        estado: venta.estado,
        fecha: new Date(venta.createdAt).toISOString(),
      })),
    },
    reportes: { pendientes: reportesPendientes, total: reportesTotal },
    filas: { activas: filasActivas },
    mensajes: { total: mensajesTotal },
    listaNegra: { total: listaNegraTotal },
    ultimosUsuarios: ultimosUsuarios.map((usuario) =>
      usuarioPublicado(resumirUsuario(usuario)),
    ),
  };
}
