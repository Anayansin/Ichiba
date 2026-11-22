import { Schema, model } from "mongoose";

const solicitudRegistroBloqueadoSchema = new Schema(
  {
    nombreCompleto: { type: String, required: true, trim: true },
    correo: { type: String, required: true, trim: true, lowercase: true },
    telefono: { type: String, trim: true, default: "" },
    rfc: { type: String, trim: true, default: "" },
    motivoBloqueo: { type: String, required: true },
    camposCoincidentes: { type: [String], default: [] },
    mensaje: { type: String, trim: true, default: "" },
    estado: {
      type: String,
      enum: ["pendiente", "en-revision", "resuelta", "descartada"],
      default: "pendiente",
    },
    respuesta: { type: String, trim: true, default: "" },
    revisadaPor: { type: String, trim: true, default: "" },
    revisadaEn: { type: Date },
  },
  { timestamps: true },
);

solicitudRegistroBloqueadoSchema.index({ estado: 1, createdAt: -1 });
solicitudRegistroBloqueadoSchema.index({ correo: 1, createdAt: -1 });

export const SolicitudRegistroBloqueado = model(
  "SolicitudRegistroBloqueado",
  solicitudRegistroBloqueadoSchema,
);
