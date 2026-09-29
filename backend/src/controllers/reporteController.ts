import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { Reporte } from "../models/Reporte.js";
import { Venta } from "../models/Venta.js";
import { Producto } from "../models/producto.js";
import { Mensaje } from "../models/Mensaje.js";
import { Usuario } from "../models/usuario.js";
import clientePrisma from "../configuracion/prisma.js";
import {
  ELEMENTOS_REPORTABLES,
  categoriaReporte,
} from "../configuracion/categoriasReporte.js";
import { registrarFalta } from "../services/sancionService.js";
import { RequestConUsuario } from "../middleware/auth.js";

const LIMITE_DETALLE = 1000;

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
      mensajeId,
      sujetoId,
      sujetoTipo,
      elemento,
      categoria,
      detalle,
    } = req.body;

    if (!ELEMENTOS_REPORTABLES.includes(elemento)) {
      return res
        .status(400)
        .json({ message: "Selecciona qué quieres reportar" });
    }

    const infoCategoria = categoriaReporte(categoria);
    if (!infoCategoria) {
      return res
        .status(400)
        .json({ message: "Selecciona una categoría válida" });
    }

    if (
      detalle !== undefined &&
      detalle !== null &&
      (typeof detalle !== "string" || detalle.length > LIMITE_DETALLE)
    ) {
      return res
        .status(400)
        .json({ message: "El detalle del reporte es demasiado largo" });
    }

    let sujeto: Identidad | null = null;
    let ventaRelacionada: any = null;

    if (sujetoId && sujetoTipo) {
      if (sujetoTipo !== "usuario" && sujetoTipo !== "comprador") {
        return res
          .status(400)
          .json({ message: "Persona a reportar no válida" });
      }
      sujeto = { tipo: sujetoTipo, id: String(sujetoId) };
    } else if (ventaId) {
      const venta = await buscarVentaDelReporte(ventaId);
      if (!venta) {
        return res.status(404).json({ message: "Compra no encontrada" });
      }

      const esComprador = venta.compradorId === reportero.id;
      const esVendedor =
        reportero.tipo === "usuario" &&
        venta.vendedorId.toString() === reportero.id;

      if (!esComprador && !esVendedor) {
        return res
          .status(403)
          .json({ message: "No puedes reportar esta compra" });
      }

      sujeto = esComprador
        ? { tipo: "usuario", id: venta.vendedorId.toString() }
        : { tipo: "comprador", id: venta.compradorId };
      ventaRelacionada = venta;
    } else if (productoId) {
      const producto = esObjectId(productoId)
        ? await Producto.findById(productoId)
        : null;
      if (!producto) {
        return res.status(404).json({ message: "Producto no encontrado" });
      }
      sujeto = { tipo: "usuario", id: String(producto.vendedorId) };
    } else {
      return res.status(400).json({
        message: "Indica la compra o el producto relacionado con tu reporte",
      });
    }

    if (sujeto.tipo === reportero.tipo && sujeto.id === reportero.id) {
      return res
        .status(400)
        .json({ message: "No puedes reportarte a ti mismo" });
    }

    if (mensajeId) {
      const mensaje = esObjectId(mensajeId)
        ? await Mensaje.findById(mensajeId)
        : null;
      if (!mensaje) {
        return res.status(404).json({ message: "Mensaje no encontrado" });
      }

      if (ventaRelacionada) {
        const ventaDelMensaje = await Venta.findById(mensaje.ventaId);
        if (
          ventaDelMensaje &&
          ventaDelMensaje.paypalOrderId !== ventaRelacionada.paypalOrderId
        ) {
          return res.status(400).json({
            message: "El mensaje reportado no pertenece a esta compra",
          });
        }
      }
    }

    const duplicado = await clientePrisma.reporte.findFirst({
      where: {
        reportadoPorTipo: reportero.tipo,
        reportadoPorId: reportero.id,
        sujetoTipo: sujeto.tipo,
        sujetoId: sujeto.id,
        categoria: infoCategoria.id,
      },
    });
    if (duplicado) {
      return res.status(400).json({
        message:
          "Ya enviaste un reporte con esta categoría para esta persona; nuestro equipo ya lo está revisando.",
      });
    }

    const vendedorRelacionado = ventaRelacionada
      ? Number(ventaRelacionada.vendedorId)
      : sujeto.tipo === "usuario" && !isNaN(Number(sujeto.id))
        ? Number(sujeto.id)
        : null;

    if (vendedorRelacionado === null) {
      return res.status(400).json({
        message: "Indica la compra relacionada con tu reporte",
      });
    }

    const reporte = await clientePrisma.reporte.create({
      data: {
        tipoReportado: sujeto.tipo === "comprador" ? "comprador" : "vendedor",
        sujetoTipo: sujeto.tipo,
        sujetoId: sujeto.id,
        reportadoPorTipo: reportero.tipo,
        reportadoPorId: reportero.id,
        ventaId: ventaRelacionada ? String(ventaRelacionada.id) : undefined,
        productoId: productoId || undefined,
        mensajeId: mensajeId || undefined,
        elemento,
        categoria: infoCategoria.id,
        categoriaNombre: infoCategoria.nombre,
        tipoFalta: infoCategoria.tipoFalta,
        detalle: typeof detalle === "string" ? detalle.trim() : undefined,
        vendedorId: vendedorRelacionado,
      },
    });

    if (sujeto.tipo === "usuario" && !isNaN(Number(sujeto.id))) {
      await clientePrisma.usuario.update({
        where: { id: Number(sujeto.id) },
        data: { totalReportes: { increment: 1 } },
      });
    }

    const estado = await registrarFalta({
      sujetoTipo: sujeto.tipo,
      sujetoId: sujeto.id,
      reporteId: String(reporte.id),
      categoria: infoCategoria.id,
      tipoFalta: infoCategoria.tipoFalta,
      elemento,
      reportadoPor: `${reportero.tipo}:${reportero.id}`,
    });

    res.status(201).json({
      message: "Reporte enviado correctamente",
      sujetoSancionado: estado.bloqueada,
    });
  } catch (error) {
    console.error("Error real:", error);
    res.status(500).json({ message: "Error al enviar el reporte" });
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
    const { ventaId, elemento, motivo, detalle } = req.body;

    if (!ventaId) {
      return res.status(400).json({
        message: "Indica la compra relacionada con tu reporte",
      });
    }

    const venta = await buscarVentaDelReporte(ventaId);
    if (!venta) {
      return res.status(404).json({ message: "Compra no encontrada" });
    }

    if (venta.vendedorId.toString() !== idVendedor) {
      return res
        .status(403)
        .json({ message: "No puedes reportar esta compra" });
    }

    if (elemento !== undefined && !ELEMENTOS_REPORTABLES.includes(elemento)) {
      return res
        .status(400)
        .json({ message: "Selecciona qué quieres reportar" });
    }

    const elementoReportado = ELEMENTOS_REPORTABLES.includes(elemento)
      ? elemento
      : "otro";

    const infoMotivo = categoriaReporte(motivo);
    if (!infoMotivo) {
      return res
        .status(400)
        .json({ message: "Selecciona una categoría válida" });
    }

    if (
      detalle !== undefined &&
      detalle !== null &&
      (typeof detalle !== "string" || detalle.length > LIMITE_DETALLE)
    ) {
      return res
        .status(400)
        .json({ message: "El detalle del reporte es demasiado largo" });
    }

    const idComprador = venta.compradorId;

    const duplicado = await clientePrisma.reporte.findFirst({
      where: {
        reportadoPorTipo: "usuario",
        reportadoPorId: idVendedor,
        sujetoTipo: "comprador",
        sujetoId: idComprador,
        categoria: infoMotivo.id,
      },
    });
    if (duplicado) {
      return res.status(400).json({
        message:
          "Ya enviaste un reporte con esta categoría para esta persona; nuestro equipo ya lo está revisando.",
      });
    }

    const reporte = await clientePrisma.reporte.create({
      data: {
        tipoReportado: "comprador",
        sujetoTipo: "comprador",
        sujetoId: idComprador,
        reportadoPorTipo: "usuario",
        reportadoPorId: idVendedor,
        ventaId: String(venta.id),
        elemento: elementoReportado,
        categoria: infoMotivo.id,
        categoriaNombre: infoMotivo.nombre,
        tipoFalta: infoMotivo.tipoFalta,
        detalle: typeof detalle === "string" ? detalle.trim() : undefined,
        vendedorId: Number(idVendedor),
      },
    });

    const estado = await registrarFalta({
      sujetoTipo: "comprador",
      sujetoId: idComprador,
      reporteId: String(reporte.id),
      categoria: infoMotivo.id,
      tipoFalta: infoMotivo.tipoFalta,
      elemento: elementoReportado,
      reportadoPor: `usuario:${idVendedor}`,
    });

    res.status(201).json({
      message: "Reporte enviado correctamente",
      sujetoSancionado: estado.bloqueada,
    });
  } catch (error) {
    console.error("Error real:", error);
    res.status(500).json({ message: "Error al enviar el reporte" });
  }
}

async function aplicarFaltaConfirmada(
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

    const faltas = await aplicarFaltaConfirmada(
      idVendedor,
      vendedor.faltasLeves,
    );

    res.json({
      message: "Reporte confirmado correctamente",
      faltasLeves: faltas.faltasLeves,
      faltaGraveRegistrada: faltas.faltaGraveRegistrada,
    });
  } catch (error) {
    console.error("Error real:", error);
    res.status(500).json({ message: "Error al confirmar el reporte" });
  }
}
