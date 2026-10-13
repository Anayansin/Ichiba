import { Request, Response } from "express";
import mongoose from "mongoose";
import { Comentario } from "../models/Comentario.js";
import { Promocional } from "../models/Promocional.js";
import clientePrisma from "../configuracion/prisma.js";
import { RequestConComprador } from "../middleware/comprador.js";
import { enviarCorreoComentarioPublicitario } from "../services/emailService.js";

const MAX_CARACTERES = 500;
const NOMBRE_POR_DEFECTO = "Visitante";

type PromocionalCargado = {
  id: string;
  nombre?: string;
  zonaComentariosHabilitada?: boolean;
  vendedorId?: unknown;
};

function idValido(valor: unknown): valor is string {
  return typeof valor === "string" && mongoose.isValidObjectId(valor);
}

/** Carga el promocional y responde con el error que corresponda (o null). */
async function promocionalOCu(
  req: Request,
  res: Response,
): Promise<PromocionalCargado | null> {
  const id = req.params.id;

  if (!idValido(id)) {
    res.status(400).json({ message: "Indica la publicación" });
    return null;
  }

  const promocional = await Promocional.findById(id).lean();
  if (!promocional) {
    res.status(404).json({ message: "Publicación no encontrada" });
    return null;
  }

  return { id, ...promocional };
}

export async function obtenerComentarios(req: Request, res: Response) {
  try {
    const cargado = await promocionalOCu(req, res);
    if (!cargado) return;

    const comentarios = await Comentario.find({ promocionalId: cargado.id })
      .sort({ createdAt: 1 })
      .lean();

    res.json(comentarios);
  } catch (error) {
    console.error("Error real:", error);
    res.status(500).json({ message: "Error al obtener los comentarios" });
  }
}

/**
 * Crea un comentario en una publicación publicitaria y, si el vendedor
 * aceptó recibir notificaciones de comentarios (RQF3), le manda un correo
 * por Gmail con el mismo servicio que usa el resto del proyecto.
 */
export async function crearComentario(
  req: RequestConComprador,
  res: Response,
) {
  try {
    const cargado = await promocionalOCu(req, res);
    if (!cargado) return;

    if (cargado.zonaComentariosHabilitada === false) {
      return res.status(403).json({
        message: "Los comentarios están deshabilitados en esta publicación",
      });
    }

    const texto = typeof req.body.texto === "string" ? req.body.texto.trim() : "";
    if (!texto) {
      return res.status(400).json({ message: "Escribe tu comentario" });
    }
    if (texto.length > MAX_CARACTERES) {
      return res.status(400).json({
        message: `El comentario no puede superar los ${MAX_CARACTERES} caracteres`,
      });
    }

    const nombreAutor =
      typeof req.body.autorNombre === "string" && req.body.autorNombre.trim()
        ? req.body.autorNombre.trim().slice(0, 50)
        : NOMBRE_POR_DEFECTO;

    const comentario = await Comentario.create({
      promocionalId: cargado.id,
      texto,
      autorNombre: nombreAutor,
      compradorId: req.compradorId ?? "",
    });

    // El correo nunca debe impedir que el comentario se guarde.
    avisarAlVendedor(cargado, texto, nombreAutor).catch((error) => {
      console.error("No se pudo enviar el correo de comentario:", error);
    });

    res.status(201).json(comentario);
  } catch (error) {
    console.error("Error real:", error);
    res.status(500).json({ message: "No se pudo publicar el comentario" });
  }
}

async function avisarAlVendedor(
  promocional: { vendedorId?: unknown; nombre?: string },
  texto: string,
  autorNombre: string,
): Promise<void> {
  const vendedorId = Number(promocional.vendedorId);
  if (!Number.isInteger(vendedorId)) return;

  const vendedor = await clientePrisma.usuario.findUnique({
    where: { id: vendedorId },
    select: {
      correo: true,
      recibirNotificacionesPublicitarias: true,
    },
  });

  if (!vendedor?.recibirNotificacionesPublicitarias) return;

  await enviarCorreoComentarioPublicitario(
    vendedor.correo,
    promocional.nombre ?? "tu publicación",
    autorNombre,
    texto,
  );
}
