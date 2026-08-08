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
    ventasExitosas: { type: Number, default: 0 },
    reportes: { type: Number, default: 0 },

    telefonoVerificado: { type: Boolean, default: false },
    correoVerificado: { type: Boolean, default: false },

    codigoTelefono: { type: String },
    codigoTelefonoExpira: { type: Date },

    codigoCorreo: { type: String },
    codigoCorreoExpira: { type: Date },
  },
  { timestamps: true },
);

export const Usuario = model("Usuario", usuarioSchema);
