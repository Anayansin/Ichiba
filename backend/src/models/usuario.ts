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
    correoVerificado: { type: Boolean, default: false },
    codigoCorreo: { type: String },
    codigoCorreoExpira: { type: Date },
    ineFrente: { type: String, required: true },
    ineReverso: { type: String, required: true },
    aceptaTerminos: { type: Boolean, required: true },
    recibirNotificacionesCriticas: { type: Boolean, required: true },
    curp: { type: String },
    ineCodigoReverso: { type: String },
    recibirNotificacionesPublicitarias: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export const Usuario = model("Usuario", usuarioSchema);
