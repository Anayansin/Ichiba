import { Schema, model } from "mongoose";

const archivoSchema = new Schema(
  {
    nombre: { type: String, required: true, unique: true },
    carpeta: { type: String, default: "" },
    tipo: { type: String, required: true },
    datos: { type: Buffer, required: true },
  },
  { timestamps: true },
);

export const Archivo = model("Archivo", archivoSchema);
