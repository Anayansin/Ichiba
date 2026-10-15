import { Schema, model } from "mongoose";

/**
 * RQNF37 / RQNF38: adeudo de un vendedor con la plataforma.
 *
 * Cuando la plataforma cubre económicamente un reembolso por culpa directa
 * del vendedor (no confirmó el comprobante, no entregó en el plazo de 15
 * días, inactividad en el chat de coordinación o una disputa resuelta en su
 * contra), se registra este adeudo por el monto reembolsado: la cuenta queda
 * suspendida con un saldo pendiente por liquidar y solo se reactiva cuando la
 * administración registra la liquidación total (RQNF38).
 */
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
    /** Id del vendedor en PostgreSQL (la cuenta que queda con el saldo). */
    usuarioId: { type: Number, required: true, index: true },
    /** Venta de PostgreSQL que originó el reembolso. */
    ventaIdPg: { type: Number, required: true },
    paypalOrderId: { type: String },
    productoId: { type: Schema.Types.ObjectId, ref: "Product" },
    productoNombre: { type: String },
    /** Monto que la plataforma reembolsó por cuenta del vendedor. */
    monto: { type: Number, required: true },
    /** Texto con el motivo del reembolso (el mismo de la cancelación). */
    motivo: { type: String, required: true },
    causa: { type: String, enum: CAUSAS_ADEUDO, default: "otro" },
    estado: {
      type: String,
      enum: ["pendiente", "liquidado"],
      default: "pendiente",
      index: true,
    },
    /** RQNF38: cuándo y quién de la administración registró la liquidación. */
    liquidadoEn: { type: Date },
    liquidadoPor: { type: String },
    nota: { type: String },
  },
  { timestamps: true },
);

export const Adeudo = model("Adeudo", adeudoSchema);
