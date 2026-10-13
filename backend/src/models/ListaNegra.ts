import { Schema, model } from "mongoose";

/**
 * Lista negra de registros de identificación. Un registro impide volver a
 * crear una cuenta con ese RFC, CURP o código de identificación (INE).
 *
 * RQNF1.9: al momento del registro se compara el RFC, la CURP y el código
 * del reverso de la INE leídos contra estas entradas; si hay coincidencia
 * se deniega el alta.
 *
 * El alta puede ser:
 * - "manual": la agrega un administrador desde el panel (/admin).
 * - "cuenta-eliminada": la agrega el sistema cuando una cuenta se elimina
 *   de forma permanente (por ejemplo, al alcanzar el límite de puntos por
 *   infracciones del RQF10).
 */
const listaNegraSchema = new Schema(
  {
    rfc: { type: String },
    curp: { type: String },
    ineCodigoReverso: { type: String },
    correo: { type: String },
    nombreCompleto: { type: String, default: "" },
    motivo: { type: String, required: true },
    origen: {
      type: String,
      enum: ["manual", "cuenta-eliminada"],
      default: "manual",
    },
  },
  { timestamps: true },
);

// Un mismo RFC o CURP no debe repetirse en la lista.
listaNegraSchema.index(
  { rfc: 1 },
  { unique: true, partialFilterExpression: { rfc: { $exists: true } } },
);
listaNegraSchema.index(
  { curp: 1 },
  { unique: true, partialFilterExpression: { curp: { $exists: true } } },
);

export const ListaNegra = model("ListaNegra", listaNegraSchema);
