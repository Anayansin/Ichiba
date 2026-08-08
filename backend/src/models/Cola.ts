import { Schema, model } from "mongoose";

const colaSchema = new Schema(
  {
    productoId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    compradorId: { type: String, required: true },
    posicion: { type: Number, required: true },
    estado: {
      type: String,
      enum: ["activa", "pagada", "finalizada"],
      default: "activa",
    },
  },
  { timestamps: true },
);

export const Cola = model("Cola", colaSchema);
