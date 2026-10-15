import { Schema, model } from "mongoose";

/**
 * Sanciones acumuladas por faltas (reportes creados por otros usuarios).
 * Una sola sanción por sujeto (usuario o comprador).
 *
 * Reglas (services/sancionService.ts):
 * - 3 faltas leves              -> bloqueo de 7 días
 * - 1 falta grave               -> bloqueo de 30 días
 * - 2 faltas graves             -> bloqueo indefinido
 * - falta grave de revisión
 *   inmediata (estafa, suplantación,
 *   amenazas, comprobante falso) -> bloqueo indefinido + revisión administrativa
 *
 * RQNF33: los bloqueos se aplican y se levantan de forma automática (el
 * trabajo `revisionSanciones` avisa del desbloqueo al concluir el periodo).
 * RQNF34: la duración crece con la reincidencia (7 días -> 30 días ->
 * indefinida). Un reporte RECHAZADO por el administrador revierte la falta
 * que había generado (se recalcula todo el estado desde el historial).
 * Las faltas solo cuentan durante 13 meses: al cumplirlos se purgan junto
 * con los reportes que las originaron (RQNF14.1).
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
    /** RQNF33: cuántos bloqueos (temporales o indefinidos) se aplicaron. */
    bloqueosAplicados: { type: Number, default: 0 },
    /** RQNF35: la cuenta quedó suspendida indefinidamente a revisión. */
    revisionAdministrativa: { type: Boolean, default: false },
    revisionMotivo: { type: String },
    revisionIniciadaEn: { type: Date },
    /**
     * Levantamiento manual del administrador: la sanción deja de bloquear.
     * Una falta nueva descarta el levantamiento y vuelve a aplicar las reglas.
     */
    levantadaPorAdminEn: { type: Date },
    levantadaPorAdminMotivo: { type: String },
    /** RQNF33: aviso de que el bloqueo temporal ya concluyó. */
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
