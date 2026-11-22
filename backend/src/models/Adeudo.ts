import { Schema, model } from "mongoose";

export const CAUSAS_ADEUDO = [
  "sin_confirmar_comprobante",
  "entrega_vencida",
  "inactividad_chat",
  "disputa_vendedor",
  "reporte_confirmado",
  "otro",
] as const;

export type CausaAdeudo = (typeof CAUSAS_ADEUDO)[number];

const adeudoSchema = new Schema(
  {
    usuarioId: { type: Number, required: true, index: true },
    ventaIdPg: { type: Number, required: true },
    paypalOrderId: { type: String },
    productoId: { type: Schema.Types.ObjectId, ref: "Product" },
    productoNombre: { type: String },
    monto: { type: Number, required: true },
    motivo: { type: String, required: true },
    causa: { type: String, enum: CAUSAS_ADEUDO, default: "otro" },
    estado: {
      type: String,
      enum: ["pendiente", "liquidado"],
      default: "pendiente",
      index: true,
    },
    liquidadoEn: { type: Date },
    liquidadoPor: { type: String },
    nota: { type: String },
  },
  { timestamps: true },
);

export const Adeudo = model("Adeudo", adeudoSchema);
