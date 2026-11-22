import { Schema, model } from "mongoose";

export const FORMATO_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const usuarioSchema = new Schema(
  {
    usuarioId: { type: Number, index: true },
    nombreCompleto: { type: String, required: true },
    direccion: { type: String, required: true },
    telefono: { type: String, required: true },
    correo: { type: String, required: true, unique: true },
    rfc: { type: String, required: true },
    password: { type: String, required: true },
    tipo: {
      type: String,
      enum: ["vendedor", "admin"],
      default: "vendedor",
    },
    ventasExitosas: { type: Number, default: 0 },
    reportes: { type: Number, default: 0 },
    faltasLeves: { type: Number, default: 0 },
    puntosReputacion: { type: Number, default: 0 },
    estadoCuenta: {
      type: String,
      enum: ["activa", "cancelada"],
      default: "activa",
    },
    canceladaEn: { type: Date },
    datosEliminadosEn: { type: Date },
    correoVerificado: { type: Boolean, default: false },
    codigoCorreo: { type: String },
    codigoCorreoExpira: { type: Date },
    codigoRecuperacion: { type: String },
    codigoRecuperacionExpira: { type: Date },
    ineFrente: { type: String, required: true },
    ineReverso: { type: String, required: true },
    aceptaTerminos: { type: Boolean, required: true },
    recibirNotificacionesCriticas: { type: Boolean, required: true },
    curp: { type: String },
    ineCodigoReverso: { type: String },
    recibirNotificacionesPublicitarias: { type: Boolean, default: false },
    metodoPago: { type: String, enum: ["paypal"], default: "paypal" },
    datosMetodoPago: { type: String, required: true },
    horarios: [
      {
        dia: { type: String, required: true },
        activo: { type: Boolean, required: true },
        horaInicio: { type: String },
        horaFin: { type: String },
      },
    ],
    horarioConfirmadoEn: { type: Date },
    diasSinConfirmarHorario: { type: Number, default: 0 },
    suspendido: { type: Boolean, default: false },
    motivoSuspension: { type: String },
    saldoPendiente: { type: Number, default: 0 },
    sancionHasta: { type: Date, default: null },
    sancionPermanente: { type: Boolean, default: false },
    bloqueosAplicados: { type: Number, default: 0 },
    revisionAdministrativa: { type: Boolean, default: false },
    motivoRevision: { type: String },
  },
  { timestamps: true },
);

export const Usuario = model("Usuario", usuarioSchema);
