import { Schema, model } from "mongoose";

const ventaSchema = new Schema(
  {
    productoId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    vendedorId: { type: String, ref: "Usuario", required: true },
    compradorId: { type: String, required: true },
    monto: { type: Number, required: true },
    paypalOrderId: { type: String, required: true },
    estado: { type: String, enum: ["completada"], default: "completada" },
    calificacionComprador: { type: Number, min: 1, max: 5 },
    calificacionVendedor: { type: Number, min: 1, max: 5 },
  },
  { timestamps: true },
);

export const Venta = model("Venta", ventaSchema);
