import { Schema, model } from "mongoose";

const colaSchema = new Schema(
  {
    productoId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    compradorId: { type: String, required: true },
    posicion: { type: Number, required: true },
    estado: {
      type: String,
      enum: ["activa", "esperando_confirmacion", "pagada", "finalizada"],
      default: "activa",
    },
    pagoExpiraEn: { type: Date },
  },
  { timestamps: true },
);

export const Cola = model("Cola", colaSchema);
