import { Schema, model } from "mongoose";

export const CONDICIONES_USO_PROMOCIONAL = [
  "nuevo",
  "usado-como-nuevo",
  "usado-buen-estado",
  "usado-aceptable",
] as const;

const promocionalSchema = new Schema(
  {
    nombre: { type: String, required: true },
    descripcion: { type: String, required: true },
    condicionUso: { type: String, enum: CONDICIONES_USO_PROMOCIONAL, required: true },
    imagenes: { type: [String], required: true },
    precio: {
      type: Number,
      required: true,
      min: [5001, "El precio del promocional debe ser mayor a $5,000"],
    },
    coberturaEnvio: { type: String, required: true },
    chatHabilitado: { type: Boolean, default: true },
    zonaComentariosHabilitada: { type: Boolean, default: true },
    vendedorId: { type: String, ref: "Usuario", required: true },
    vendedor: { type: String, required: true },
    activo: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const Promocional = model("Promocional", promocionalSchema);
