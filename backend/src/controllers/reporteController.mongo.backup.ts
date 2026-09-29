import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { isValidObjectId } from "mongoose";
import { Reporte } from "../models/Reporte.js";
import { Venta } from "../models/Venta.js";
import { Producto } from "../models/producto.js";
import { Mensaje } from "../models/Mensaje.js";
import { Usuario } from "../models/usuario.js";
import {
  ELEMENTOS_REPORTABLES,
  categoriaReporte,
} from "../configuracion/categoriasReporte.js";
import { registrarFalta } from "../services/sancionService.js";

const LIMITE_DETALLE = 1000;

type Identidad = { tipo: "usuario" | "comprador"; id: string };

/**
 * El reporte puede enviarlo el vendedor (JWT) o el comprador
 * (x-comprador-id). Los reportes siempre están permitidos, aunque el
 * reportero tenga una sanción vigente.
 */
async function identificarReportero(req: Request): Promise<Identidad | null> {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    try {
      const payload = jwt.verify(
        authHeader.split(" ")[1],
        process.env.JWT_SECRET as string,
      ) as { id: string };
      return { tipo: "usuario", id: payload.id };
    } catch {
      // Token inválido: se continúa por si también envía su compradorId.
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

    // Resolver a quién se reporta
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
      const venta = await Venta.findById(ventaId);
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
      const producto = await Producto.findById(productoId);
      if (!producto) {
        return res.status(404).json({ message: "Producto no encontrado" });
      }
      sujeto = { tipo: "usuario", id: producto.vendedorId.toString() };
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
      const mensaje = await Mensaje.findById(mensajeId);
      if (!mensaje) {
        return res.status(404).json({ message: "Mensaje no encontrado" });
      }
      if (
        ventaRelacionada &&
        mensaje.ventaId.toString() !== ventaRelacionada._id.toString()
      ) {
        return res.status(400).json({
          message: "El mensaje reportado no pertenece a esta compra",
        });
      }
    }

    const duplicado = await Reporte.findOne({
      reportadoPorTipo: reportero.tipo,
      reportadoPorId: reportero.id,
      sujetoTipo: sujeto.tipo,
      sujetoId: sujeto.id,
      categoria: infoCategoria.id,
    });
    if (duplicado) {
      return res.status(400).json({
        message:
          "Ya enviaste un reporte con esta categoría para esta persona; nuestro equipo ya lo está revisando.",
      });
    }

    const reporte = await Reporte.create({
      sujetoTipo: sujeto.tipo,
      sujetoId: sujeto.id,
      reportadoPorTipo: reportero.tipo,
      reportadoPorId: reportero.id,
      ventaId: ventaRelacionada ? ventaRelacionada._id : undefined,
      productoId: productoId || undefined,
      mensajeId: mensajeId || undefined,
      elemento,
      categoria: infoCategoria.id,
      categoriaNombre: infoCategoria.nombre,
      tipoFalta: infoCategoria.tipoFalta,
      detalle: typeof detalle === "string" ? detalle.trim() : undefined,
    });

    if (sujeto.tipo === "usuario" && isValidObjectId(sujeto.id)) {
      await Usuario.findByIdAndUpdate(sujeto.id, { $inc: { reportes: 1 } });
    }

    const estado = await registrarFalta({
      sujetoTipo: sujeto.tipo,
      sujetoId: sujeto.id,
      reporteId: String(reporte._id),
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
