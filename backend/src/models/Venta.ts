import { Schema, model } from "mongoose";

const ventaSchema = new Schema(
  {
    productoId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    vendedorId: { type: Schema.Types.ObjectId, ref: "Usuario", required: true },
    compradorId: { type: String, required: true },
    monto: { type: Number, required: true },
    paypalOrderId: { type: String, required: true },
    estado: { type: String, enum: ["completada"], default: "completada" },
  },
  { timestamps: true },
);

export const Venta = model("Venta", ventaSchema);
