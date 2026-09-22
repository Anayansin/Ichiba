import { Schema, model } from "mongoose";

export const CATEGORIAS_NOTIFICACION = [
  "artesanias",
  "ropa",
  "hogar",
  "electrodomesticos",
  "coleccionables",
  "otros",
];

const suscripcionSchema = new Schema(
  {
    compradorId: { type: String, required: true, unique: true },
    correo: { type: String, required: true },
    categorias: {
      type: [String],
      required: true,
      validate: [
        (categorias: string[]) => categorias.length > 0,
        "Debes seleccionar al menos una categoría",
      ],
    },
    aceptaTerminos: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export const Suscripcion = model("Suscripcion", suscripcionSchema);
