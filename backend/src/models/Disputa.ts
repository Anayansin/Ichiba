import { Schema, model } from "mongoose";

export const ESTADOS_DISPUTA = ["abierta", "reembolsada", "rechazada"] as const;

const disputaSchema = new Schema(
  {
    ventaIdPg: { type: Number, required: true, index: true },
    ventaMongoId: { type: Schema.Types.ObjectId, ref: "Venta" },
    paypalOrderId: { type: String },
    productoId: { type: Schema.Types.ObjectId, ref: "Product" },
    productoNombre: { type: String },
    compradorId: { type: String, required: true, index: true },
    vendedorId: { type: Number, required: true, index: true },
    monto: { type: Number, required: true },
    motivo: { type: String, required: true },
    descripcion: { type: String },
    evidenciasComprador: [{ type: String }],
    respuestaVendedor: { type: String },
    evidenciasVendedor: [{ type: String }],
    respondidaEn: { type: Date },
    estado: {
      type: String,
      enum: ESTADOS_DISPUTA,
      default: "abierta",
      index: true,
    },
    resueltaEn: { type: Date },
    resueltaPor: { type: String },
    notaAdmin: { type: String },
    reembolsoId: { type: String },
  },
  { timestamps: true },
);

export const Disputa = model("Disputa", disputaSchema);
