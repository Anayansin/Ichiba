import { Schema, model } from "mongoose";

/**
 * RQNF4 — Vinculación de la cuenta del vendedor con PayPal.
 *
 * Cuando el vendedor autoriza su cuenta desde la pasarela (RQF4), el backend
 * guarda aquí el Merchant ID (`payer_id`) y el Token de Acceso CIFRADO con
 * AES-256-GCM: la columna `tokenCifrado` jamás contiene texto plano.
 */
const vinculoPayPalSchema = new Schema(
  {
    /** Id numérico de la cuenta en PostgreSQL. */
    usuarioId: { type: Number, required: true, unique: true, index: true },
    /** Correo de la cuenta de PayPal que autorizó el acceso. */
    correoPayPal: { type: String, required: true },
    /** Merchant ID (payer_id) con el que PayPal identifica al vendedor. */
    merchantId: { type: String, required: true },
    /** Token de Acceso en texto ilegible (AES-256-GCM). */
    tokenCifrado: { type: String, required: true },
    /** Token de refresco, también cifrado. */
    refrescoCifrado: { type: String },
    /** Vigencia del Token de Acceso según PayPal. */
    tokenExpiraEn: { type: Date },
    vinculadoEn: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

export const VinculoPayPal = model("VinculoPayPal", vinculoPayPalSchema);

/**
 * `state` aleatorio del flujo OAuth 2.0: protege contra CSRF y contra que
 * alguien intente completar la vinculación con un `code` ajeno. Vive pocos
 * minutos y se consume al usarse.
 */
const estadoVinculacionSchema = new Schema({
  state: { type: String, required: true, unique: true, index: true },
  usuarioId: { type: Number, required: true },
  expira: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
});

export const EstadoVinculacionPayPal = model(
  "EstadoVinculacionPayPal",
  estadoVinculacionSchema,
);
