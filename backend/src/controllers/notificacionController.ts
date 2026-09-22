import { Response } from "express";
import {
  Suscripcion,
  CATEGORIAS_NOTIFICACION,
} from "../models/Suscripcion.js";
import { RequestConComprador } from "../middleware/comprador.js";

const FORMATO_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Guarda (o elimina) las preferencias de notificación del comprador:
 * correo + una o más categorías de interés.
 */
export async function guardarSuscripcion(
  req: RequestConComprador,
  res: Response,
) {
  try {
    const compradorId = req.compradorId as string;
    const { correo, categorias } = req.body;

    const correoLimpio =
      typeof correo === "string" ? correo.trim().toLowerCase() : "";
    const listaCategorias: string[] = Array.isArray(categorias)
      ? categorias.filter((categoria) => typeof categoria === "string")
      : [];

    if (correoLimpio && !FORMATO_CORREO.test(correoLimpio)) {
      return res.status(400).json({ message: "Escribe un correo válido" });
    }

    if (correoLimpio && listaCategorias.length === 0) {
      return res
        .status(400)
        .json({ message: "Selecciona al menos una categoría" });
    }

    if (!correoLimpio && listaCategorias.length > 0) {
      return res
        .status(400)
        .json({ message: "Escribe tu correo para recibir notificaciones" });
    }

    const categoriaInvalida = listaCategorias.find(
      (categoria) => !CATEGORIAS_NOTIFICACION.includes(categoria),
    );
    if (categoriaInvalida) {
      return res
        .status(400)
        .json({ message: "Selecciona categorías válidas" });
    }

    // Sin correo ni categorías: el comprador no quiere notificaciones
    if (!correoLimpio && listaCategorias.length === 0) {
      await Suscripcion.deleteOne({ compradorId });
      return res.json({
        message: "Preferencias guardadas",
        suscripcion: null,
      });
    }

    const suscripcion = await Suscripcion.findOneAndUpdate(
      { compradorId },
      {
        compradorId,
        correo: correoLimpio,
        categorias: listaCategorias,
        aceptaTerminos: true,
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    res.json({ message: "Preferencias guardadas", suscripcion });
  } catch (error) {
    console.error("Error real:", error);
    res
      .status(500)
      .json({ message: "No se pudieron guardar tus preferencias" });
  }
}
