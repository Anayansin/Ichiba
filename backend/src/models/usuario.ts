import { Schema, model } from "mongoose";

const usuarioSchema = new Schema(
  {
    nombreCompleto: { type: String, required: true },
    direccion: { type: String, required: true },
    telefono: { type: String, required: true },
    correo: { type: String, required: true, unique: true },
    rfc: { type: String, required: true },
    password: { type: String, required: true },
    tipo: { type: String, enum: ["vendedor"], default: "vendedor" },
  },
  { timestamps: true },
);

export const Usuario = model("Usuario", usuarioSchema);
