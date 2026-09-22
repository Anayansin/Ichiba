import { Schema, model } from "mongoose";

/**
 * Sanciones acumuladas por reincidencia en faltas (reportes confirmados
 * por otros usuarios). Una sola sanción por sujeto (usuario o comprador).
 *
 * Reglas (services/sancionService.ts):
 * - 3 faltas leves        -> bloqueo de 7 días
 * - 1 falta grave         -> bloqueo de 30 días
 * - 2 faltas graves       -> bloqueo permanente
 * El historial nunca se borra: los bloques expirados siguen contando.
 */
const sancionSchema = new Schema(
  {
    sujetoTipo: {
      type: String,
      enum: ["usuario", "comprador"],
      required: true,
    },
    sujetoId: { type: String, required: true },
    faltasLeves: { type: Number, default: 0 },
    faltasGraves: { type: Number, default: 0 },
    bloqueadoHasta: { type: Date, default: null },
    bloqueoPermanente: { type: Boolean, default: false },
    historial: [
      {
        reporteId: { type: Schema.Types.ObjectId, ref: "Reporte" },
        categoria: { type: String, required: true },
        tipoFalta: { type: String, enum: ["leve", "grave"], required: true },
        elemento: { type: String },
        reportadoPor: { type: String },
        fecha: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true },
);

sancionSchema.index({ sujetoTipo: 1, sujetoId: 1 }, { unique: true });

export const Sancion = model("Sancion", sancionSchema);
