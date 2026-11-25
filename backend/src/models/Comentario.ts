import { Schema, model } from "mongoose";

const comentarioSchema = new Schema(
  {
    promocionalId: { type: String, required: true, index: true },
    texto: { type: String, required: true, trim: true },
    autorNombre: { type: String, default: "Visitante", trim: true },
    compradorId: { type: String, default: "" },
    respuesta: {
      texto: { type: String, trim: true },
      fecha: { type: Date },
    },
  },
  { timestamps: true },
);

export const Comentario = model("Comentario", comentarioSchema);
