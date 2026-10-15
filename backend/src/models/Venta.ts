import { Schema, model } from "mongoose";

/**
 * Espejo en MongoDB de la venta de PostgreSQL (fuente de verdad).
 *
 * El chat, la calificación, los reportes y el historial de administración
 * leen esta colección, así que debe reflejar el ciclo del escrow (RQNF4):
 *
 *   pendiente_comprobante  -> pago autorizado; falta registrar el comprobante
 *   pendiente_confirmacion -> comprobante enviado; el vendedor debe revisarlo
 *   en_entrega             -> comprobante confirmado; chat abierto
 *   completada             -> entregado y fondos liberados
 *   reembolsada            -> dinero devuelto al comprador
 *   cancelada              -> cancelada sin cobro (autorización anulada)
 */
export const ESTADOS_VENTA = [
  "pendiente_comprobante",
  "pendiente_confirmacion",
  "en_entrega",
  "completada",
  "reembolsada",
  "cancelada",
] as const;

const ventaSchema = new Schema(
  {
    productoId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    vendedorId: { type: String, ref: "Usuario", required: true },
    compradorId: { type: String, required: true },
    monto: { type: Number, required: true },
    paypalOrderId: { type: String, required: true },
    estado: {
      type: String,
      enum: ESTADOS_VENTA,
      default: "pendiente_comprobante",
    },
    // RQNF20: palabra clave de 4 dígitos de la sesión de pago.
    codigoPago: { type: String },
    // RQNF4 (escrow): autorización de PayPal de la captura diferida.
    autorizacionPaypalId: { type: String },
    // RQF22: comprobante de pago.
    comprobantePalabraClave: { type: String },
    comprobanteReferencia: { type: String },
    comprobanteImagen: { type: String },
    comprobanteEnviadoEn: { type: Date },
    // RQNF24 / RQNF31: instante en que el vendedor confirmó el comprobante.
    comprobanteConfirmadoEn: { type: Date },
    // RQNF24.4: código de confirmación de entrega.
    codigoEntrega: { type: String },
    // RQNF24 / RQNF28 / RQNF31: fechas límite del flujo.
    confirmacionLimite: { type: Date },
    entregaLimite: { type: Date },
    ultimoMensajeEn: { type: Date },
    entregadoEn: { type: Date },
    // RQNF27: captura de PayPal hecha al liberar los fondos (escrow).
    capturaPaypalId: { type: String },
    // RQNF10.2 / RQNF23 / RQNF28: reembolsos.
    reembolsadoEn: { type: Date },
    reembolsoId: { type: String },
    canceladoMotivo: { type: String },
    // RQNF32: retención preventiva de fondos.
    retenido: { type: Boolean, default: false },
    calificacionComprador: { type: Number, min: 1, max: 5 },
    calificacionVendedor: { type: Number, min: 1, max: 5 },
  },
  { timestamps: true },
);

export const Venta = model("Venta", ventaSchema);
