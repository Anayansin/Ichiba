import fs from "fs";
import path from "path";
import clientePrisma from "../configuracion/prisma.js";
import { Producto } from "../models/producto.js";
import { Promocional } from "../models/Promocional.js";
import { Mensaje } from "../models/Mensaje.js";
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

export const PUNTOS_CANCELACION = 8;

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
  puntos: number;
  puntosReputacion: number;
  cancelacion: ResultadoCancelacion | null;
};

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

  let cancelacion: ResultadoCancelacion | null = null;
  if (vendedor && puntosReputacion >= PUNTOS_CANCELACION) {
    cancelacion = await cancelarCuentaPorPuntos(vendedorId);
  }

  await publicarCambioDeReputacion(
    vendedorId,
    puntosReputacion,
    cancelacion,
    vendedor,
  );
  publicarResumenAdmin();

  return { puntos, puntosReputacion, cancelacion };
}

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
    const cuenta = await clientePrisma.usuario.findUnique({
      where: { id: vendedorId },
    });
    const resumen = resumirUsuario({
      ...(cuenta ?? {}),
      id: vendedorId,
      puntosReputacion,
      estadoCuenta: cancelacion
        ? "cancelada"
        : String(cuenta?.estadoCuenta ?? "activa"),
      nombreCompleto: String(cuenta?.nombreCompleto ?? vendedor?.nombreCompleto ?? ""),
      correo: String(cuenta?.correo ?? vendedor?.correo ?? ""),
      tipo: String(cuenta?.tipo ?? vendedor?.tipo ?? "vendedor"),
      createdAt: cuenta?.createdAt ?? vendedor?.createdAt ?? null,
    });

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

  await clientePrisma.usuario.update({
    where: { id: vendedorId },
    data: {
      estadoCuenta: "cancelada",
      canceladaEn: ahora,
    },
  });

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

  try {
    await agregarAListaNegra({
      rfc: vendedor.rfc,
      curp: vendedor.curp,
      ineCodigoReverso: vendedor.ineCodigoReverso,
      motivo: `Cuenta cancelada de forma permanente por acumular ${PUNTOS_CANCELACION} puntos de reputación por infracción`,
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

  await publicarListaNegraActualizada(
    "agregada",
    "La cuenta cancelada se agregó a la lista negra",
  );

  await Producto.updateMany(
    { vendedorId: String(vendedorId) },
    { activo: false },
  );
  await Promocional.updateMany(
    { vendedorId: String(vendedorId) },
    { activo: false },
  );

  let filasCanceladas = 0;
  try {
    filasCanceladas = await cancelarFilasSinPagoDelVendedor(vendedorId);
  } catch (error) {
    console.error(
      "[cancelacion] No se pudieron cancelar las filas del vendedor:",
      error instanceof Error ? error.message : error,
    );
  }

  const purgada = await purgarCuentaSiCorresponde(vendedorId);

  return {
    cuentaCancelada: true,
    yaCancelada: false,
    correoEnviado,
    filasCanceladas,
    purgada,
  };
}

function borrarArchivosIne(...rutas: (string | null | undefined)[]) {
  for (const ruta of rutas) {
    if (!ruta) continue;
    try {
      const absoluta = path.resolve(process.cwd(), ruta.replace(/^\/+/, ""));
      fs.unlink(absoluta, () => {});
    } catch {
    }
  }
}

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

  await Producto.deleteMany({ vendedorId: vendedorEnTexto });
  await Promocional.deleteMany({ vendedorId: vendedorEnTexto });

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

  await VinculoPayPal.deleteOne({ usuarioId: vendedorId }).catch(() => {});
  await EstadoVinculacionPayPal.deleteMany({ usuarioId: vendedorId }).catch(
    () => {},
  );

  borrarArchivosIne(vendedor.ineFrente, vendedor.ineReverso);

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

  await publicarEventoUsuario(
    "purgada",
    `Se purgó por completo la cuenta cancelada #${vendedorId}`,
    null,
  );
  publicarResumenAdmin();

  return true;
}

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
