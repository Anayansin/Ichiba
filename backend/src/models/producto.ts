import { Schema, model } from "mongoose";

const productoSchema = new Schema(
  {
    nombre: { type: String, required: true },
    precio: { type: Number, required: true },
    imagen: { type: String, required: true },
    categoria: { type: String, required: true },
  },
  { timestamps: true },
);

export const Producto = model("Product", productoSchema);
