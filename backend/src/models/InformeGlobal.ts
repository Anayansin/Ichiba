import { Schema, model } from "mongoose";

const categoriaGlobalSchema = new Schema(
  {
    categoria: { type: String, required: true },
    ventas: { type: Number, default: 0 },
    filasIniciadas: { type: Number, default: 0 },
    filasAbandonadas: { type: Number, default: 0 },
    tasaAbandono: { type: Number, default: 0 },
  },
  { _id: false },
);

const informeGlobalSchema = new Schema(
  {
    periodo: { type: String, required: true, unique: true },
    generadoEn: { type: Date, default: Date.now },
    categoriaMasVendida: {
      type: new Schema(
        {
          categoria: { type: String, required: true },
          ventas: { type: Number, default: 0 },
        },
        { _id: false },
      ),
      default: null,
    },
    empate: { type: Boolean, default: false },
    porCategoria: { type: [categoriaGlobalSchema], default: [] },
  },
  { timestamps: true },
);

export const InformeGlobal = model("InformeGlobal", informeGlobalSchema);
