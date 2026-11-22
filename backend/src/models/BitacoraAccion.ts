import { Schema, model } from "mongoose";

const bitacoraAccionSchema = new Schema(
  {
    actorTipo: {
      type: String,
      enum: ["usuario", "comprador", "visitante", "sistema"],
      required: true,
    },
    actorId: { type: String, default: null },
    actorNombre: { type: String, default: null },
    accion: { type: String, required: true },
    descripcion: { type: String, required: true },
    ruta: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

bitacoraAccionSchema.index({ createdAt: -1 });
bitacoraAccionSchema.index({ actorId: 1, createdAt: -1 });

export const BitacoraAccion = model("BitacoraAccion", bitacoraAccionSchema);
