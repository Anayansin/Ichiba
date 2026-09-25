import { Schema, model } from "mongoose";
import { CATEGORIAS_PROMOCIONAL } from "../configuracion/categorias.js";

/**
 * Promocional: anuncio de algo que no se vende dentro de la plataforma
 * (casas, autos, terrenos, joyas, servicios, etc.). No tiene entrega,
 * horarios ni tiempo de pago porque la coordinación es directa con el vendedor.
 */
const promocionalSchema = new Schema(
  {
    nombre: { type: String, required: true },
    precio: { type: Number, required: true },
    categoria: {
      type: String,
      enum: [...CATEGORIAS_PROMOCIONAL],
      required: true,
    },
    descripcion: { type: String, required: true },
    imagenes: { type: [String], required: true },
    vendedor: { type: String, required: true },
    vendedorId: { type: Schema.Types.ObjectId, ref: "Usuario", required: true },
    activo: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const Promocional = model("Promocional", promocionalSchema);
