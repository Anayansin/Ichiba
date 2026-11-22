import { Schema, model } from "mongoose";

const productoVendidoSchema = new Schema(
  {
    productoId: { type: String, required: true },
    nombre: { type: String, default: "" },
    cantidad: { type: Number, default: 0 },
    monto: { type: Number, default: 0 },
  },
  { _id: false },
);

const informeVendedorSchema = new Schema(
  {
    vendedorId: { type: String, required: true },
    periodo: { type: String, required: true },
    generadoEn: { type: Date, default: Date.now },
    totalVentas: { type: Number, default: 0 },
    ingresos: { type: Number, default: 0 },
    productosVendidos: { type: [productoVendidoSchema], default: [] },
    filasIniciadas: { type: Number, default: 0 },
    ventasConcluidas: { type: Number, default: 0 },
    tasaConcertacion: { type: Number, default: 0 },
    tiempoPromedioFilaMinutos: { type: Number, default: null },
  },
  { timestamps: true },
);

informeVendedorSchema.index({ vendedorId: 1, periodo: 1 }, { unique: true });

export const InformeVendedor = model("InformeVendedor", informeVendedorSchema);
