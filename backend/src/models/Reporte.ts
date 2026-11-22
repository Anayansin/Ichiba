import { Schema, model } from "mongoose";
import { ELEMENTOS_REPORTABLES } from "../configuracion/categoriasReporte.js";

const reporteSchema = new Schema(
  {
    tipoReportado: {
      type: String,
      enum: ["vendedor", "comprador"],
      required: true,
      default: "vendedor",
    },
    sujetoTipo: {
      type: String,
      enum: ["usuario", "comprador"],
      required: true,
    },
    sujetoId: { type: String, required: true },
    reportadoPorTipo: {
      type: String,
      enum: ["usuario", "comprador"],
      required: true,
    },
    reportadoPorId: { type: String, required: true },
    ventaId: { type: Schema.Types.ObjectId, ref: "Venta" },
    productoId: { type: Schema.Types.ObjectId, ref: "Product" },
    mensajeId: { type: Schema.Types.ObjectId, ref: "Mensaje" },
    elemento: { type: String, enum: [...ELEMENTOS_REPORTABLES, "mensaje", "comentario", "comprobante", "estafa", "producto", "otro"], required: true },
    categoria: { type: String, required: true },
    categoriaNombre: { type: String, required: true },
    tipoFalta: { type: String, enum: ["leve", "grave"], required: true },
    detalle: { type: String },
    estado: {
      type: String,
      enum: ["pendiente", "revisado", "confirmado"],
      default: "pendiente",
    },
  },
  { timestamps: true },
);

export const Reporte = model("Reporte", reporteSchema);
