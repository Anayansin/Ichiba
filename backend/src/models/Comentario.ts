import { Schema, model } from "mongoose";

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
