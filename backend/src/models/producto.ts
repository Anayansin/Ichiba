import { Schema, model } from "mongoose";

const productoSchema = new Schema(
  {
    nombre: { type: String, required: true },
    precio: { type: Number, required: true },
    imagenes: { type: [String], required: true },
    categoria: { type: String, required: true },
    descripcion: { type: String, required: true },
    vendedor: { type: String, required: true },
    vendedorId: { type: Schema.Types.ObjectId, ref: "Usuario", required: true },
    datosDeEnvio: { type: String, required: true },
  },
  { timestamps: true },
);

export const Producto = model("Product", productoSchema);
