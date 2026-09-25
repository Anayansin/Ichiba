import { Schema, model } from "mongoose";

const mensajeSchema = new Schema(
  {
    ventaId: { type: Schema.Types.ObjectId, ref: "Venta", required: true },
    remitente: {
      type: String,
      enum: ["comprador", "vendedor"],
      required: true,
    },
    remitenteId: { type: String, required: true },
    // Un mensaje puede llevar texto, una imagen adjunta o ambos
    contenido: { type: String, default: "" },
    imagen: { type: String, default: null },
    leido: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export const Mensaje = model("Mensaje", mensajeSchema);
