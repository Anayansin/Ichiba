import clientePrisma from "../configuracion/prisma.js";
import { ListaNegra } from "../models/ListaNegra.js";
import { Mensaje } from "../models/Mensaje.js";
import { Producto } from "../models/producto.js";
import { Promocional } from "../models/Promocional.js";
import { relojZonaCentro } from "../utils/validarHorario.js";

export type UsuarioResumido = {
  id: string;
  nombreCompleto: string;
  correo: string;
  tipo: string;
  suspendido: boolean;
  puntosReputacion: number;
  estadoCuenta: string;
  fechaRegistro: Date | null;
  motivoSuspension: string | null;
  saldoPendiente: number;
  sancionHasta: Date | null;
  sancionPermanente: boolean;
  revisionAdministrativa: boolean;
};

export type UsuarioPublicado = Omit<
  UsuarioResumido,
  "fechaRegistro" | "sancionHasta"
> & {
  fechaRegistro: string | null;
  sancionHasta: string | null;
};

export function resumirUsuario(usuario: {
  _id?: unknown;
  id?: unknown;
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
    id: String(usuario._id ?? usuario.id ?? ""),
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
    clientePrisma.usuario.count(),
    clientePrisma.usuario.count({ where: { suspendido: false } }),
    clientePrisma.usuario.count({ where: { suspendido: true } }),
    clientePrisma.usuario.count({ where: { estadoCuenta: "cancelada" } }),
    clientePrisma.usuario.count({ where: { tipo: "admin" } }),
    clientePrisma.usuario.count({
      where: { createdAt: { gte: desde30Dias } },
    }),
    clientePrisma.usuario.findMany({
      orderBy: { id: "desc" },
      skip: 0,
      limit: 5,
    }),
    Producto.countDocuments(),
    Producto.countDocuments({ activo: true }),
    Promocional.countDocuments(),
    Promocional.countDocuments({ activo: true }),
    Mensaje.countDocuments(),
    ListaNegra.countDocuments(),
    clientePrisma.venta.findMany({ orderBy: { createdAt: "desc" } }),
    clientePrisma.reporte.count({ where: { estado: "pendiente" } }),
    clientePrisma.reporte.count(),
    clientePrisma.cola.count({
      where: { estado: { in: ["activa", "esperando_confirmacion"] } },
    }),
  ]);

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
