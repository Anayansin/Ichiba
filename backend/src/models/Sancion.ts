import { Schema, model } from "mongoose";

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
    bloqueosAplicados: { type: Number, default: 0 },
    revisionAdministrativa: { type: Boolean, default: false },
    revisionMotivo: { type: String },
    revisionIniciadaEn: { type: Date },
    levantadaPorAdminEn: { type: Date },
    levantadaPorAdminMotivo: { type: String },
    avisoDesbloqueoEn: { type: Date },
    historial: [
      {
        reporteId: { type: String, ref: "Reporte" },
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
