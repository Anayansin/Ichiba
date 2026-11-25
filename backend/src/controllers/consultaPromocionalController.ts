import { Response } from "express";
import { Promocional } from "../models/Promocional.js";
import { Comentario } from "../models/Comentario.js";
import { ConsultaPromocional } from "../models/ConsultaPromocional.js";
import type { RequestConComprador } from "../middleware/comprador.js";
import type { RequestConUsuario } from "../middleware/auth.js";

const MAX_CARACTERES = 500;

function textoDe(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : "";
}

function validarTexto(texto: string, res: Response): boolean {
  if (!texto) {
    res.status(400).json({ message: "Escribe tu mensaje" });
    return false;
  }
  if (texto.length > MAX_CARACTERES) {
    res.status(400).json({
      message: `El mensaje no puede superar los ${MAX_CARACTERES} caracteres`,
    });
    return false;
  }
  return true;
}

async function promocionalDelVendedor(
  id: string,
  vendedorId: string,
  res: Response,
) {
  const promocional = await Promocional.findById(id).lean();
  if (!promocional) {
    res.status(404).json({ message: "Publicación no encontrada" });
    return null;
  }
  if (String(promocional.vendedorId) !== vendedorId) {
    res.status(403).json({ message: "Solo el vendedor de esta publicación puede responder" });
    return null;
  }
  return promocional;
}

export async function responderComentario(req: RequestConUsuario, res: Response) {
  try {
    const promocional = await promocionalDelVendedor(
      String(req.params.id),
      String(req.usuarioId ?? ""),
      res,
    );
    if (!promocional) return;
    if (promocional.zonaComentariosHabilitada === false) {
      return res.status(403).json({
        message: "Los comentarios están deshabilitados en esta publicación",
      });
    }

    const texto = textoDe(req.body?.texto);
    if (!validarTexto(texto, res)) return;

    const comentario = await Comentario.findOneAndUpdate(
      { _id: req.params.comentarioId, promocionalId: String(promocional._id) },
      { $set: { respuesta: { texto, fecha: new Date() } } },
      { returnDocument: "after" },
    ).lean();
    if (!comentario) {
      return res.status(404).json({ message: "Comentario no encontrado" });
    }

    res.json(comentario);
  } catch (error) {
    console.error("Error al responder el comentario:", error);
    res.status(500).json({ message: "No se pudo publicar la respuesta" });
  }
}

export async function consultaDelComprador(req: RequestConComprador, res: Response) {
  try {
    const mensajes = await ConsultaPromocional.find({
      promocionalId: String(req.params.id),
      compradorId: String(req.compradorId),
    })
      .sort({ createdAt: 1 })
      .lean();
    res.json(mensajes);
  } catch (error) {
    console.error("Error al obtener la consulta:", error);
    res.status(500).json({ message: "Error al obtener tus mensajes" });
  }
}

export async function enviarConsultaComprador(
  req: RequestConComprador,
  res: Response,
) {
  try {
    const promocional = await Promocional.findById(String(req.params.id)).lean();
    if (!promocional || promocional.activo === false) {
      return res.status(404).json({ message: "Publicación no encontrada" });
    }
    if (promocional.chatHabilitado === false) {
      return res.status(403).json({
        message: "El vendedor no habilitó el chat de consulta en esta publicación",
      });
    }

    const contenido = textoDe(req.body?.contenido);
    if (!validarTexto(contenido, res)) return;

    const mensaje = await ConsultaPromocional.create({
      promocionalId: String(promocional._id),
      vendedorId: String(promocional.vendedorId),
      compradorId: String(req.compradorId),
      remitente: "comprador",
      contenido,
    });

    res.status(201).json(mensaje);
  } catch (error) {
    console.error("Error al enviar la consulta:", error);
    res.status(500).json({ message: "No se pudo enviar tu mensaje" });
  }
}

export async function consultasDelVendedor(req: RequestConUsuario, res: Response) {
  try {
    const vendedorId = String(req.usuarioId ?? "");
    const mensajes = await ConsultaPromocional.find({ vendedorId })
      .sort({ createdAt: 1 })
      .lean();

    const nombres = new Map(
      (
        await Promocional.find({
          _id: { $in: [...new Set(mensajes.map((m) => m.promocionalId))] },
        })
          .select("nombre")
          .lean()
      ).map((p) => [String(p._id), p.nombre]),
    );

    const conversaciones = new Map<
      string,
      {
        promocionalId: string;
        promocionalNombre: string;
        compradorId: string;
        mensajes: typeof mensajes;
      }
    >();
    for (const mensaje of mensajes) {
      const clave = `${mensaje.promocionalId}:${mensaje.compradorId}`;
      const conversacion = conversaciones.get(clave) ?? {
        promocionalId: mensaje.promocionalId,
        promocionalNombre: nombres.get(mensaje.promocionalId) ?? "Publicación eliminada",
        compradorId: mensaje.compradorId,
        mensajes: [],
      };
      conversacion.mensajes.push(mensaje);
      conversaciones.set(clave, conversacion);
    }

    res.json(
      [...conversaciones.values()].sort(
        (a, b) =>
          new Date(b.mensajes[b.mensajes.length - 1].createdAt).getTime() -
          new Date(a.mensajes[a.mensajes.length - 1].createdAt).getTime(),
      ),
    );
  } catch (error) {
    console.error("Error al obtener las consultas:", error);
    res.status(500).json({ message: "Error al obtener tus consultas" });
  }
}

export async function responderConsulta(req: RequestConUsuario, res: Response) {
  try {
    const promocional = await promocionalDelVendedor(
      String(req.params.id),
      String(req.usuarioId ?? ""),
      res,
    );
    if (!promocional) return;
    if (promocional.chatHabilitado === false) {
      return res.status(403).json({
        message: "El chat de consulta está deshabilitado en esta publicación",
      });
    }

    const compradorId = String(req.params.compradorId ?? "");
    const existe = await ConsultaPromocional.exists({
      promocionalId: String(promocional._id),
      compradorId,
    });
    if (!existe) {
      return res.status(404).json({ message: "Conversación no encontrada" });
    }

    const contenido = textoDe(req.body?.contenido);
    if (!validarTexto(contenido, res)) return;

    const mensaje = await ConsultaPromocional.create({
      promocionalId: String(promocional._id),
      vendedorId: String(promocional.vendedorId),
      compradorId,
      remitente: "vendedor",
      contenido,
    });

    res.status(201).json(mensaje);
  } catch (error) {
    console.error("Error al responder la consulta:", error);
    res.status(500).json({ message: "No se pudo enviar tu respuesta" });
  }
}
