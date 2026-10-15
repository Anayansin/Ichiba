import { Schema, model } from "mongoose";

/**
 * RQF14 / RQNF14 / RQNF14.2: informe global mensual de la plataforma.
 * Se genera el día 1° de cada mes y muestra la categoría más vendida y la
 * tasa de abandono de fila por categoría (KO9.1).
 */
const categoriaGlobalSchema = new Schema(
  {
    categoria: { type: String, required: true },
    /** Transacciones concluidas de la categoría en el período. */
    ventas: { type: Number, default: 0 },
    /** Filas virtuales iniciadas en productos de la categoría. */
    filasIniciadas: { type: Number, default: 0 },
    /** RQNF14.2 (KO9.1): filas abandonadas (salieron o no pagaron a tiempo). */
    filasAbandonadas: { type: Number, default: 0 },
    /** Abandonadas / iniciadas, en porcentaje. */
    tasaAbandono: { type: Number, default: 0 },
  },
  { _id: false },
);

const informeGlobalSchema = new Schema(
  {
    /** Mes del informe en formato "YYYY-MM". */
    periodo: { type: String, required: true, unique: true },
    generadoEn: { type: Date, default: Date.now },
    /** RQNF14: categoría con más ventas concluidas; null si hubo empate total. */
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
    /** RQNF14.2: true cuando el empate persistió tras el desempate. */
    empate: { type: Boolean, default: false },
    porCategoria: { type: [categoriaGlobalSchema], default: [] },
  },
  { timestamps: true },
);

export const InformeGlobal = model("InformeGlobal", informeGlobalSchema);
