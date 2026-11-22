import { Schema, model } from "mongoose";

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

listaNegraSchema.index(
  { rfc: 1 },
  { unique: true, partialFilterExpression: { rfc: { $exists: true } } },
);
listaNegraSchema.index(
  { curp: 1 },
  { unique: true, partialFilterExpression: { curp: { $exists: true } } },
);

export const ListaNegra = model("ListaNegra", listaNegraSchema);
