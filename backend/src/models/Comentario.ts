import { Schema, model } from "mongoose";

/**
 * Comentarios que los visitantes dejan en una publicación publicitaria
 * (promocional). El comprador se identifica con el `x-comprador-id`
 * anónimo que el frontend adjunta a cada petición.
 *
 * Cuando se crea uno, el controlador avisa por correo al dueño del anuncio
 * si este aceptó recibir notificaciones de comentarios (RQF3).
 */
const comentarioSchema = new Schema(
  {
    promocionalId: { type: String, required: true, index: true },
    texto: { type: String, required: true, trim: true },
    autorNombre: { type: String, default: "Visitante", trim: true },
    compradorId: { type: String, default: "" },
  },
  { timestamps: true },
);

export const Comentario = model("Comentario", comentarioSchema);
