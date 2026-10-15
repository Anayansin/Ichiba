import { Schema, model } from "mongoose";

/**
 * RQF40 / RQNF32: disputa de reembolso de una compra.
 *
 * El comprador abre la disputa (solo en ventas `en_entrega` o `completada`)
 * con su motivo, descripción y evidencias (comprobante, fotografías del
 * producto, capturas del chat). Mientras la disputa siga abierta el pago
 * queda retenido en el escrow (RQNF32). El vendedor puede responder con sus
 * propias evidencias y, finalmente, la administración dictamina desde el
 * BackOffice: reembolsar al comprador o rechazar la disputa.
 */
export const ESTADOS_DISPUTA = ["abierta", "reembolsada", "rechazada"] as const;

const disputaSchema = new Schema(
  {
    /** Venta de PostgreSQL (fuente de verdad del escrow). */
    ventaIdPg: { type: Number, required: true, index: true },
    /** Espejo de la venta en MongoDB (para el chat y la auditoría). */
    ventaMongoId: { type: Schema.Types.ObjectId, ref: "Venta" },
    paypalOrderId: { type: String },
    productoId: { type: Schema.Types.ObjectId, ref: "Product" },
    productoNombre: { type: String },
    compradorId: { type: String, required: true, index: true },
    vendedorId: { type: Number, required: true, index: true },
    monto: { type: Number, required: true },
    /** Motivo corto elegido por el comprador. */
    motivo: { type: String, required: true },
    /** Explicación detallada de lo sucedido. */
    descripcion: { type: String },
    /** RQF40: evidencias del comprador (rutas de imágenes). */
    evidenciasComprador: [{ type: String }],
    /** Respuesta del vendedor con sus propias evidencias. */
    respuestaVendedor: { type: String },
    evidenciasVendedor: [{ type: String }],
    respondidaEn: { type: Date },
    estado: {
      type: String,
      enum: ESTADOS_DISPUTA,
      default: "abierta",
      index: true,
    },
    /** Dictamen de la administración (RQF40). */
    resueltaEn: { type: Date },
    resueltaPor: { type: String },
    notaAdmin: { type: String },
    /** Id del reembolso procesado por la pasarela, si aplica. */
    reembolsoId: { type: String },
  },
  { timestamps: true },
);

export const Disputa = model("Disputa", disputaSchema);
