import { Request, Response } from "express";
import { SuscripcionCategoria } from "../models/SuscripcionCategoria.js";
import { CATEGORIAS_NOTIFICACION } from "../models/Suscripcion.js";
import { FORMATO_CORREO } from "../models/usuario.js";

export async function suscribirseCategoria(req: Request, res: Response) {
  try {
    const correo =
      typeof req.body.correo === "string"
        ? req.body.correo.trim().toLowerCase()
        : "";

    if (!FORMATO_CORREO.test(correo)) {
      return res
        .status(400)
        .json({ message: "Déjanos un correo válido para suscribirte" });
    }

    const categoria =
      typeof req.body.categoria === "string"
        ? req.body.categoria.trim().toLowerCase()
        : "";

    if (!CATEGORIAS_NOTIFICACION.includes(categoria)) {
      return res
        .status(400)
        .json({ message: "Selecciona una categoría válida" });
    }

    await SuscripcionCategoria.updateOne(
      { correo, categoria },
      { $setOnInsert: { correo, categoria } },
      { upsert: true },
    );

    res.status(201).json({ message: "Te suscribiste a la categoría" });
  } catch (error) {
    console.error("Error real:", error);
    res.status(500).json({ message: "Error al guardar la suscripción" });
  }
}
