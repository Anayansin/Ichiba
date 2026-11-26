import { Schema, model } from "mongoose";

export const ASUNTOS_QUEJA = [
  "compra",
  "vendedor",
  "pago",
  "entrega",
  "plataforma",
  "otro",
] as const;

export const ESTADOS_QUEJA = ["abierta", "en_revision", "atendida"] as const;

const quejaSchema = new Schema(
  {
    autorTipo: {
      type: String,
      enum: ["usuario", "comprador"],
      required: true,
    },
    autorId: { type: String, required: true, index: true },
    nombre: { type: String, trim: true, default: "" },
    correo: { type: String, trim: true, default: "" },
    asunto: { type: String, enum: ASUNTOS_QUEJA, required: true },
    mensaje: { type: String, required: true, trim: true },
    referencia: { type: String, trim: true, default: "" },
    estado: {
      type: String,
      enum: ESTADOS_QUEJA,
      default: "abierta",
      index: true,
    },
    respuestaAdmin: { type: String, trim: true, default: "" },
    atendidaEn: { type: Date },
  },
  { timestamps: true },
);

export const Queja = model("Queja", quejaSchema);
