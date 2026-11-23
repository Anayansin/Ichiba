import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { Venta } from "../models/Venta.js";
import { Producto } from "../models/producto.js";
import { Mensaje } from "../models/Mensaje.js";
import clientePrisma from "../configuracion/prisma.js";
import {
  CATEGORIA_REVISION_MANUAL,
  ELEMENTOS_REPORTABLES,
  categoriaReporte,
} from "../configuracion/categoriasReporte.js";
import { Promocional } from "../models/Promocional.js";
import { ErrorBackoffice } from "../services/errorBackoffice.js";
import { resolverReporteAdmin } from "../services/backofficeService.js";
import { registrarFalta } from "../services/sancionService.js";
import {
  acumularPuntosDeReporte,
  PUNTOS_CANCELACION,
} from "../services/cancelacionCuentaService.js";
import { aplicarFaltaConfirmada } from "../services/backofficeService.js";
import { marcarVentaRetenidaPorReporte } from "../services/disputaService.js";
import {
  publicarReportesPendientes,
  publicarResumenAdmin,
} from "../graphql/suscripciones.js";
import { RequestConUsuario } from "../middleware/auth.js";


type Identidad = { tipo: "usuario" | "comprador"; id: string };

function esObjectId(valor: unknown): valor is string {
  return typeof valor === "string" && /^[0-9a-fA-F]{24}$/.test(valor);
}

async function identificarReportero(req: Request): Promise<Identidad | null> {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    try {
      const payload = jwt.verify(
        authHeader.split(" ")[1],
        process.env.JWT_SECRET as string,
      ) as { id: string };
      return { tipo: "usuario", id: String(payload.id) };
    } catch {
    }
  }

  const compradorId = req.headers["x-comprador-id"] as string | undefined;
  if (compradorId) return { tipo: "comprador", id: compradorId };

  return null;
}

const DETALLE_MINIMO = 30;
const DETALLE_MAXIMO = 500;

type DatosNuevoReporte = {
  reportero: Identidad;
  sujeto: Identidad;
  elemento: string;
  categoria: string;
  detalle: string;
  ventaRelacionada: any;
  productoId?: string;
  mensajeId?: string;
  vendedorRelacionado: number;
};

function validarDetalle(detalle: unknown): string | null {
  const texto = typeof detalle === "string" ? detalle.trim() : "";
  if (texto.length < DETALLE_MINIMO || texto.length > DETALLE_MAXIMO) {
    return `El detalle debe tener entre ${DETALLE_MINIMO} y ${DETALLE_MAXIMO} caracteres`;
  }
  return null;
}

async function registrarReporte(datos: DatosNuevoReporte) {
  const infoCategoria = categoriaReporte(datos.categoria);
  if (!infoCategoria) {
    throw new ErrorBackoffice(400, "Selecciona una categoría válida");
  }

  const duplicado = await clientePrisma.reporte.findFirst({
    where: {
      reportadoPorTipo: datos.reportero.tipo,
      reportadoPorId: datos.reportero.id,
      sujetoTipo: datos.sujeto.tipo,
      sujetoId: datos.sujeto.id,
      categoria: infoCategoria.id,
    },
  });
  if (duplicado) {
    throw new ErrorBackoffice(
      400,
      "Ya enviaste un reporte con esta categoría para esta persona",
    );
  }

  const reporte = await clientePrisma.reporte.create({
    data: {
      tipoReportado: datos.sujeto.tipo === "comprador" ? "comprador" : "vendedor",
      sujetoTipo: datos.sujeto.tipo,
      sujetoId: datos.sujeto.id,
      reportadoPorTipo: datos.reportero.tipo,
      reportadoPorId: datos.reportero.id,
      ventaId: datos.ventaRelacionada ? String(datos.ventaRelacionada.id) : undefined,
      productoId: datos.productoId || undefined,
      mensajeId: datos.mensajeId || undefined,
      elemento: datos.elemento,
      categoria: infoCategoria.id,
      categoriaNombre: infoCategoria.nombre,
      tipoFalta: infoCategoria.tipoFalta,
      detalle: datos.detalle.trim(),
      vendedorId: datos.vendedorRelacionado,
    },
  });

  if (datos.sujeto.tipo === "usuario" && !isNaN(Number(datos.sujeto.id))) {
    await clientePrisma.usuario.update({
      where: { id: Number(datos.sujeto.id) },
      data: { totalReportes: { increment: 1 } },
    });
  }

  if (infoCategoria.id !== CATEGORIA_REVISION_MANUAL) {
    await registrarFalta({
      sujetoTipo: datos.sujeto.tipo,
      sujetoId: datos.sujeto.id,
      reporteId: String(reporte.id),
      categoria: infoCategoria.id,
      tipoFalta: infoCategoria.tipoFalta,
      elemento: datos.elemento,
      reportadoPor: `${datos.reportero.tipo}:${datos.reportero.id}`,
    });
  }

  if (infoCategoria.id === CATEGORIA_REVISION_MANUAL) {
    if (datos.ventaRelacionada) {
      try {
        await marcarVentaRetenidaPorReporte(Number(datos.ventaRelacionada.id));
      } catch (error) {
        console.error(
          "[reportes] No se pudo retener el pago de la venta reportada:",
          error instanceof Error ? error.message : error,
        );
      }
    }
    await publicarReportesPendientes(
      "creado",
      "Nuevo reporte de «Otro motivo» pendiente de revisión",
    );
    publicarResumenAdmin();
    return {
      id: reporte.id,
      estado: "pendiente",
      message:
        "Reporte enviado. Como elegiste «Otro motivo», un administrador lo revisará manualmente.",
    };
  }

  const resolucion = await resolverReporteAdmin(reporte.id, "confirmado");
  return {
    id: reporte.id,
    estado: "confirmado",
    message: resolucion.cuentaCancelada
      ? "Reporte enviado y registrado. La cuenta reportada alcanzó el límite de puntos y fue cancelada."
      : "Reporte enviado y registrado en el historial de la cuenta reportada.",
  };
}

function responderErrorReporte(res: Response, error: unknown) {
  if (error instanceof ErrorBackoffice) {
    return res.status(error.estado).json({ message: error.message });
  }
  console.error("[reportes] Error al enviar el reporte:", error);
  return res.status(500).json({ message: "Error al enviar el reporte" });
}

export async function crearReporte(req: Request, res: Response) {
  try {
    const reportero = await identificarReportero(req);
    if (!reportero) {
      return res
        .status(401)
        .json({ message: "Identifícate para enviar un reporte" });
    }

    const {
      ventaId,
      productoId,
      promocionalId,
      mensajeId,
      vendedorId,
      elemento,
      categoria,
      detalle,
    } = req.body ?? {};

    if (!ELEMENTOS_REPORTABLES.includes(elemento)) {
      return res.status(400).json({ message: "Selecciona qué quieres reportar" });
    }
    if (!categoriaReporte(categoria)) {
      return res.status(400).json({ message: "Selecciona una categoría válida" });
    }
    const errorDetalle = validarDetalle(detalle);
    if (errorDetalle) return res.status(400).json({ message: errorDetalle });

    let sujeto: Identidad | null = null;
    let ventaRelacionada: any = null;
    let productoRelacionado: string | undefined;

    if (ventaId) {
      const venta = await buscarVentaDelReporte(ventaId);
      if (!venta) {
        return res.status(404).json({ message: "Compra no encontrada" });
      }
      const esComprador = venta.compradorId === reportero.id;
      const esVendedor =
        reportero.tipo === "usuario" &&
        venta.vendedorId.toString() === reportero.id;
      if (!esComprador && !esVendedor) {
        return res.status(403).json({
          message:
            "Solo el comprador o el vendedor de esta compra pueden reportarla",
        });
      }
      sujeto = esVendedor
        ? { tipo: "comprador", id: venta.compradorId }
        : { tipo: "usuario", id: venta.vendedorId.toString() };
      ventaRelacionada = venta;
      productoRelacionado = String(venta.productoId);
    } else if (productoId) {
      const producto = esObjectId(productoId)
        ? await Producto.findById(productoId)
        : null;
      if (!producto) {
        return res.status(404).json({ message: "Publicación no encontrada" });
      }
      sujeto = { tipo: "usuario", id: String(producto.vendedorId) };
      productoRelacionado = String(producto._id);
    } else if (promocionalId) {
      const promocional = esObjectId(promocionalId)
        ? await Promocional.findById(promocionalId)
        : null;
      if (!promocional) {
        return res.status(404).json({ message: "Publicación no encontrada" });
      }
      sujeto = { tipo: "usuario", id: String(promocional.vendedorId) };
      productoRelacionado = String(promocional._id);
    } else if (vendedorId && !isNaN(Number(vendedorId))) {
      const vendedor = await clientePrisma.usuario.findUnique({
        where: { id: Number(vendedorId) },
        select: { id: true },
      });
      if (!vendedor) {
        return res.status(404).json({ message: "Vendedor no encontrado" });
      }
      sujeto = { tipo: "usuario", id: String(vendedor.id) };
    } else {
      return res.status(400).json({
        message:
          "Indica la compra, la publicación o el vendedor que quieres reportar",
      });
    }

    if (sujeto.tipo === reportero.tipo && sujeto.id === reportero.id) {
      return res.status(400).json({ message: "No puedes reportarte a ti mismo" });
    }

    if (mensajeId) {
      const mensaje = esObjectId(mensajeId)
        ? await Mensaje.findById(mensajeId)
        : null;
      if (!mensaje) {
        return res.status(404).json({ message: "Mensaje no encontrado" });
      }
    }

    const vendedorRelacionado = ventaRelacionada
      ? Number(ventaRelacionada.vendedorId)
      : Number(sujeto.id);

    const vendedorExiste =
      Number.isInteger(vendedorRelacionado) &&
      (await clientePrisma.usuario.findUnique({
        where: { id: vendedorRelacionado },
        select: { id: true },
      }));
    if (!vendedorExiste) {
      return res
        .status(404)
        .json({ message: "La cuenta del vendedor ya no existe" });
    }

    const resultado = await registrarReporte({
      reportero,
      sujeto,
      elemento,
      categoria,
      detalle,
      ventaRelacionada,
      productoId: productoRelacionado,
      mensajeId,
      vendedorRelacionado,
    });

    res.status(201).json(resultado);
  } catch (error) {
    responderErrorReporte(res, error);
  }
}

export async function crearReporteComprador(
  req: RequestConUsuario,
  res: Response,
) {
  try {
    if (!req.usuarioId) {
      return res
        .status(401)
        .json({ message: "Identifícate para enviar un reporte" });
    }

    const idVendedor = String(req.usuarioId);
    const { ventaId, motivo, categoria, detalle } = req.body ?? {};
    const categoriaElegida = categoria ?? motivo;

    if (!ventaId) {
      return res
        .status(400)
        .json({ message: "Indica la compra relacionada con tu reporte" });
    }
    if (!categoriaReporte(categoriaElegida)) {
      return res.status(400).json({ message: "Selecciona una categoría válida" });
    }
    const errorDetalle = validarDetalle(detalle);
    if (errorDetalle) return res.status(400).json({ message: errorDetalle });

    const venta = await buscarVentaDelReporte(ventaId);
    if (!venta) {
      return res.status(404).json({ message: "Compra no encontrada" });
    }
    if (venta.vendedorId.toString() !== idVendedor) {
      return res.status(403).json({
        message: "Solo el vendedor de esta compra puede reportar al cliente",
      });
    }

    const resultado = await registrarReporte({
      reportero: { tipo: "usuario", id: idVendedor },
      sujeto: { tipo: "comprador", id: venta.compradorId },
      elemento: "cliente",
      categoria: categoriaElegida,
      detalle,
      ventaRelacionada: venta,
      productoId: String(venta.productoId),
      vendedorRelacionado: Number(idVendedor),
    });

    res.status(201).json(resultado);
  } catch (error) {
    responderErrorReporte(res, error);
  }
}

export async function misReportes(req: Request, res: Response) {
  try {
    const reportero = await identificarReportero(req);
    if (!reportero) return res.json([]);

    const reportes = await clientePrisma.reporte.findMany({
      where: { reportadoPorTipo: reportero.tipo, reportadoPorId: reportero.id },
      orderBy: { createdAt: "desc" },
    });

    res.json(
      reportes.map((reporte) => ({
        id: reporte.id,
        elemento: reporte.elemento,
        categoriaNombre: reporte.categoriaNombre,
        detalle: reporte.detalle,
        estado: reporte.estado,
        createdAt: reporte.createdAt,
        updatedAt: reporte.updatedAt,
      })),
    );
  } catch (error) {
    console.error("[reportes] Error al listar mis reportes:", error);
    res.status(500).json({ message: "Error al obtener tus reportes" });
  }
}

async function buscarVentaDelReporte(ventaId: unknown) {
  const idEnTexto = String(ventaId);

  if (/^\d+$/.test(idEnTexto)) {
    return clientePrisma.venta.findUnique({
      where: { id: Number(idEnTexto) },
    });
  }

  if (!/^[0-9a-fA-F]{24}$/.test(idEnTexto)) {
    return null;
  }

  const ventaEnMongo = await Venta.findById(idEnTexto);
  if (!ventaEnMongo) {
    return null;
  }

  return clientePrisma.venta.findFirst({
    where: { paypalOrderId: ventaEnMongo.paypalOrderId },
  });
}

export async function listarReportes(req: Request, res: Response) {
  try {
    const estado =
      typeof req.query.estado === "string" ? req.query.estado : undefined;

    const condicion: Record<string, unknown> = {};
    if (estado) condicion.estado = estado;

    const reportes = await clientePrisma.reporte.findMany({
      where: condicion,
      orderBy: { createdAt: "desc" },
    });

    const vendedores: Record<string, string> = {};
    for (const reporte of reportes) {
      const idVendedor = String(reporte.vendedorId);
      if (vendedores[idVendedor]) continue;

      const vendedor = await clientePrisma.usuario.findUnique({
        where: { id: Number(reporte.vendedorId) },
        select: { nombreCompleto: true },
      });
      vendedores[idVendedor] = vendedor
        ? vendedor.nombreCompleto
        : "Vendedor no encontrado";
    }

    res.json(
      reportes.map((reporte) => ({
        ...reporte,
        vendedorNombre: vendedores[String(reporte.vendedorId)],
      })),
    );
  } catch (error) {
    console.error("Error real:", error);
    res.status(500).json({ message: "Error al obtener los reportes" });
  }
}

export async function confirmarReporte(req: Request, res: Response) {
  try {
    const idReporte = req.params.id ?? req.body?.reporteId;

    if (!idReporte || isNaN(Number(idReporte))) {
      return res
        .status(400)
        .json({ message: "Indica el reporte que quieres confirmar" });
    }

    const reporte = await clientePrisma.reporte.findUnique({
      where: { id: Number(idReporte) },
    });
    if (!reporte) {
      return res.status(404).json({ message: "Reporte no encontrado" });
    }

    if (reporte.estado === "confirmado") {
      return res
        .status(400)
        .json({ message: "Este reporte ya está confirmado" });
    }

    const esReporteContraVendedor =
      reporte.tipoReportado === "vendedor" || reporte.sujetoTipo === "usuario";
    if (!esReporteContraVendedor) {
      return res
        .status(400)
        .json({ message: "Este reporte no es contra un vendedor" });
    }

    const idVendedor = Number(reporte.sujetoId);
    if (!Number.isFinite(idVendedor)) {
      return res
        .status(400)
        .json({ message: "El vendedor de este reporte no es válido" });
    }

    const vendedor = await clientePrisma.usuario.findUnique({
      where: { id: idVendedor },
    });
    if (!vendedor) {
      return res.status(404).json({ message: "Vendedor no encontrado" });
    }

    await clientePrisma.reporte.update({
      where: { id: reporte.id },
      data: { estado: "confirmado" },
    });

    if (reporte.categoria === CATEGORIA_REVISION_MANUAL) {
      await registrarFalta({
        sujetoTipo: "usuario",
        sujetoId: String(idVendedor),
        reporteId: String(reporte.id),
        categoria: reporte.categoria,
        tipoFalta: reporte.tipoFalta === "grave" ? "grave" : "leve",
        elemento: String(reporte.elemento),
        reportadoPor: `${reporte.reportadoPorTipo}:${reporte.reportadoPorId}`,
      });
    }

    const faltas = await aplicarFaltaConfirmada(
      idVendedor,
      vendedor.faltasLeves,
    );

    const resultadoPuntos = await acumularPuntosDeReporte(
      idVendedor,
      reporte.categoria,
      reporte.tipoFalta,
    );

    await publicarReportesPendientes(
      "resuelto",
      "Se confirmó un reporte de la bandeja",
    );
    publicarResumenAdmin();

    res.json({
      message: resultadoPuntos.cancelacion
        ? `Reporte confirmado: el vendedor alcanzó ${PUNTOS_CANCELACION} puntos y su cuenta fue cancelada de forma permanente`
        : "Reporte confirmado correctamente",
      faltasLeves: faltas.faltasLeves,
      faltaGraveRegistrada: faltas.faltaGraveRegistrada,
      puntos: resultadoPuntos.puntos,
      puntosReputacion: resultadoPuntos.puntosReputacion,
      cuentaCancelada: Boolean(resultadoPuntos.cancelacion),
    });
  } catch (error) {
    console.error("Error real:", error);
    res.status(500).json({ message: "Error al confirmar el reporte" });
  }
}
