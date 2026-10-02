import { Schema, model } from "mongoose";

const suscripcionCategoriaSchema = new Schema(
  {
    correo: { type: String, required: true },
    categoria: { type: String, required: true },
  },
  { timestamps: true },
);

suscripcionCategoriaSchema.index({ correo: 1, categoria: 1 }, { unique: true });

export const SuscripcionCategoria = model(
  "SuscripcionCategoria",
  suscripcionCategoriaSchema,
);
