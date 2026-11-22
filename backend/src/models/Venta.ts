import { Schema, model } from "mongoose";

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
    ventaIdPg: { type: Number },
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
    codigoPago: { type: String },
    autorizacionPaypalId: { type: String },
    comprobantePalabraClave: { type: String },
    comprobanteReferencia: { type: String },
    comprobanteImagen: { type: String },
    comprobanteEnviadoEn: { type: Date },
    comprobanteConfirmadoEn: { type: Date },
    codigoEntrega: { type: String },
    confirmacionLimite: { type: Date },
    entregaLimite: { type: Date },
    ultimoMensajeEn: { type: Date },
    entregadoEn: { type: Date },
    capturaPaypalId: { type: String },
    reembolsadoEn: { type: Date },
    reembolsoId: { type: String },
    canceladoMotivo: { type: String },
    retenido: { type: Boolean, default: false },
    propuestaEntrega: {
      lugar: { type: String },
      fecha: { type: String },
      hora: { type: String },
      estado: { type: String, enum: ["pendiente", "aceptada", "rechazada"] },
      registradaEn: { type: Date },
      respondidaEn: { type: Date },
    },
    propuestasRechazadas: [
      {
        lugar: { type: String },
        fecha: { type: String },
        hora: { type: String },
        registradaEn: { type: Date },
        respondidaEn: { type: Date },
      },
    ],
    direccionEntrega: {
      nombreRecibe: { type: String },
      calleNumero: { type: String },
      colonia: { type: String },
      codigoPostal: { type: String },
      ciudad: { type: String },
      estado: { type: String },
      telefono: { type: String },
      referencias: { type: String },
      registradaEn: { type: Date },
    },
    datosEnvio: {
      paqueteria: { type: String },
      numeroGuia: { type: String },
      fechaEstimada: { type: String },
      registradoEn: { type: Date },
    },
    calificacionComprador: { type: Number, min: 1, max: 5 },
    calificacionVendedor: { type: Number, min: 1, max: 5 },
  },
  { timestamps: true },
);

export const Venta = model("Venta", ventaSchema);
