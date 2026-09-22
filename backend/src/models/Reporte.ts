import { Schema, model } from "mongoose";
import { ELEMENTOS_REPORTABLES } from "../configuracion/categoriasReporte.js";

/**
 * Reporte de un usuario contra la otra persona de una compra
 * (comprador -> vendedor o vendedor -> comprador).
 */
const reporteSchema = new Schema(
  {
    // Quién recibe el reporte
    sujetoTipo: {
      type: String,
      enum: ["usuario", "comprador"],
      required: true,
    },
    sujetoId: { type: String, required: true },
    // Quién envía el reporte
    reportadoPorTipo: {
      type: String,
      enum: ["usuario", "comprador"],
      required: true,
    },
    reportadoPorId: { type: String, required: true },
    ventaId: { type: Schema.Types.ObjectId, ref: "Venta" },
    productoId: { type: Schema.Types.ObjectId, ref: "Product" },
    mensajeId: { type: Schema.Types.ObjectId, ref: "Mensaje" },
    elemento: { type: String, enum: ELEMENTOS_REPORTABLES, required: true },
    categoria: { type: String, required: true },
    categoriaNombre: { type: String, required: true },
    tipoFalta: { type: String, enum: ["leve", "grave"], required: true },
    detalle: { type: String },
    estado: {
      type: String,
      enum: ["pendiente", "revisado"],
      default: "pendiente",
    },
  },
  { timestamps: true },
);

export const Reporte = model("Reporte", reporteSchema);
