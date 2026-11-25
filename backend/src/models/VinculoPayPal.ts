import { Schema, model } from "mongoose";

const vinculoPayPalSchema = new Schema(
  {
    usuarioId: { type: Number, required: true, unique: true, index: true },
    correoPayPal: { type: String, required: true },
    merchantId: { type: String },
    tokenCifrado: { type: String, required: true },
    refrescoCifrado: { type: String },
    tokenExpiraEn: { type: Date },
    vinculadoEn: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

export const VinculoPayPal = model("VinculoPayPal", vinculoPayPalSchema);

const estadoVinculacionSchema = new Schema({
  state: { type: String, required: true, unique: true, index: true },
  usuarioId: { type: Number, required: true },
  expira: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
});

export const EstadoVinculacionPayPal = model(
  "EstadoVinculacionPayPal",
  estadoVinculacionSchema,
);
