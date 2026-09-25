import { Response, Request } from "express";
import fs from "fs";
import { Mensaje } from "../models/Mensaje.js";
import { Venta } from "../models/Venta.js";
import { RequestConComprador } from "../middleware/comprador.js";
import { RequestConUsuario } from "../middleware/auth.js";
import {
  campoConPalabrasProhibidas,
  mensajePalabrasProhibidas,
} from "../utils/filtroPalabras.js";

async function validarAccesoComprador(ventaId: string, compradorId: string) {
  const venta = await Venta.findById(ventaId);
  if (!venta) return null;
  if (venta.compradorId !== compradorId) return null;
  return venta;
}

async function validarAccesoVendedor(ventaId: string, vendedorId: string) {
  const venta = await Venta.findById(ventaId);
  if (!venta) return null;
  if (venta.vendedorId.toString() !== vendedorId) return null;
  return venta;
}

/** Elimina la imagen subida cuando el mensaje no se va a guardar. */
function descartarImagen(req: Request) {
  if (req.file) fs.unlink(req.file.path, () => {});
}

/**
 * Valida el texto y la imagen adjunta del mensaje entrante.
 * El filtro global de palabras corre antes de que Multer arme el cuerpo
 * multipart, así que aquí se vuelve a revisar el contenido.
 */
function datosDelMensaje(req: Request): {
  contenido: string;
  imagen: string;
  error?: string;
} {
  const contenido =
    typeof req.body?.contenido === "string" ? req.body.contenido.trim() : "";
  const imagen = req.file ? `/uploads/${req.file.filename}` : "";

  const rechazar = (mensaje: string) => {
    descartarImagen(req);
    return { contenido: "", imagen: "", error: mensaje };
  };

  if (!contenido && !imagen)
    return rechazar("Escribe un mensaje o adjunta una imagen");

  const campoProhibido = campoConPalabrasProhibidas({ contenido });
  if (campoProhibido)
    return rechazar(mensajePalabrasProhibidas(campoProhibido));

  return { contenido, imagen };
}

export async function fetchMensajesComoComprador(
  req: RequestConComprador,
  res: Response,
) {
  try {
    const ventaId = req.params.ventaId as string;
    const compradorId = req.compradorId as string;

    const venta = await validarAccesoComprador(ventaId, compradorId);
    if (!venta)
      return res.status(403).json({ message: "No tienes acceso a este chat" });

    const mensajes = await Mensaje.find({ ventaId }).sort({ createdAt: 1 });
    res.json(mensajes);
  } catch (error) {
    console.error("Error real:", error);
    res.status(500).json({ message: "Error al obtener los mensajes" });
  }
}

export async function enviarMensajeComoComprador(
  req: RequestConComprador,
  res: Response,
) {
  try {
    const ventaId = req.params.ventaId as string;
    const compradorId = req.compradorId as string;

    const venta = await validarAccesoComprador(ventaId, compradorId);
    if (!venta) {
      descartarImagen(req);
      return res.status(403).json({ message: "No tienes acceso a este chat" });
    }

    const { contenido, imagen, error } = datosDelMensaje(req);
    if (error) return res.status(400).json({ message: error });

    const mensaje = new Mensaje({
      ventaId,
      remitente: "comprador",
      remitenteId: compradorId,
      contenido,
      imagen: imagen || null,
    });
    await mensaje.save();

    res.status(201).json(mensaje);
  } catch (error) {
    console.error("Error real:", error);
    res.status(500).json({ message: "Error al enviar el mensaje" });
  }
}

export async function fetchMensajesComoVendedor(
  req: RequestConUsuario,
  res: Response,
) {
  try {
    const ventaId = req.params.ventaId as string;
    const vendedorId = req.usuarioId as string;

    const venta = await validarAccesoVendedor(ventaId, vendedorId);
    if (!venta)
      return res.status(403).json({ message: "No tienes acceso a este chat" });

    const mensajes = await Mensaje.find({ ventaId }).sort({ createdAt: 1 });
    res.json(mensajes);
  } catch (error) {
    console.error("Error real:", error);
    res.status(500).json({ message: "Error al obtener los mensajes" });
  }
}

export async function enviarMensajeComoVendedor(
  req: RequestConUsuario,
  res: Response,
) {
  try {
    const ventaId = req.params.ventaId as string;
    const vendedorId = req.usuarioId as string;

    const venta = await validarAccesoVendedor(ventaId, vendedorId);
    if (!venta) {
      descartarImagen(req);
      return res.status(403).json({ message: "No tienes acceso a este chat" });
    }

    const { contenido, imagen, error } = datosDelMensaje(req);
    if (error) return res.status(400).json({ message: error });

    const mensaje = new Mensaje({
      ventaId,
      remitente: "vendedor",
      remitenteId: vendedorId,
      contenido,
      imagen: imagen || null,
    });
    await mensaje.save();

    res.status(201).json(mensaje);
  } catch (error) {
    console.error("Error real:", error);
    res.status(500).json({ message: "Error al enviar el mensaje" });
  }
}

export async function fetchMisVentasComoComprador(
  req: RequestConComprador,
  res: Response,
) {
  try {
    const compradorId = req.compradorId as string;
    const ventas = await Venta.find({ compradorId })
      .populate("productoId", "nombre imagenes")
      .sort({ createdAt: -1 });
    res.json(ventas);
  } catch (error) {
    console.error("Error real:", error);
    res.status(500).json({ message: "Error al obtener tus compras" });
  }
}

export async function fetchMisVentasComoVendedor(
  req: RequestConUsuario,
  res: Response,
) {
  try {
    const vendedorId = req.usuarioId as string;
    const ventas = await Venta.find({ vendedorId })
      .populate("productoId", "nombre imagenes")
      .sort({ createdAt: -1 });
    res.json(ventas);
  } catch (error) {
    console.error("Error real:", error);
    res.status(500).json({ message: "Error al obtener tus ventas" });
  }
}
