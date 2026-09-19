import { Schema, model } from "mongoose";

const reporteSchema = new Schema(
  {
    vendedorId: { type: Schema.Types.ObjectId, ref: "Usuario", required: true },
    compradorId: { type: String, required: true },
    motivo: { type: String, required: true },
    detalle: { type: String },
    estado: {
      type: String,
      enum: ["pendiente", "revisado"],
      default: "pendiente",
    },
  },
  { timestamps: true },
);

export const Reporte = model("Reporte", reporteSchema);
