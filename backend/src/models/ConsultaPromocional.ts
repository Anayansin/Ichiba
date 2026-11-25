import { Schema, model } from "mongoose";

const consultaPromocionalSchema = new Schema(
  {
    promocionalId: { type: String, required: true, index: true },
    vendedorId: { type: String, required: true, index: true },
    compradorId: { type: String, required: true, index: true },
    remitente: { type: String, enum: ["comprador", "vendedor"], required: true },
    contenido: { type: String, required: true, trim: true },
  },
  { timestamps: true },
);

consultaPromocionalSchema.index({ promocionalId: 1, compradorId: 1, createdAt: 1 });

export const ConsultaPromocional = model(
  "ConsultaPromocional",
  consultaPromocionalSchema,
);
