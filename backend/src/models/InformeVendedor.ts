import { Schema, model } from "mongoose";

/**
 * RQF13 / RQNF13.1 / RQNF13.2 / RQNF13.3: informe mensual de ventas de un
 * vendedor. Se genera el día 1° de cada mes con las transacciones concluidas
 * dentro del mes anterior y se conserva como historial descargable en PDF.
 */
const productoVendidoSchema = new Schema(
  {
    productoId: { type: String, required: true },
    nombre: { type: String, default: "" },
    cantidad: { type: Number, default: 0 },
    monto: { type: Number, default: 0 },
  },
  { _id: false },
);

const informeVendedorSchema = new Schema(
  {
    vendedorId: { type: String, required: true },
    /** Mes del informe en formato "YYYY-MM". */
    periodo: { type: String, required: true },
    generadoEn: { type: Date, default: Date.now },
    /** Total de ventas por período (número de transacciones concluidas). */
    totalVentas: { type: Number, default: 0 },
    /** Monto total vendido en el período. */
    ingresos: { type: Number, default: 0 },
    /** Productos vendidos en el período (agrupados). */
    productosVendidos: { type: [productoVendidoSchema], default: [] },
    /** RQNF13.1: filas virtuales iniciadas en todos sus productos. */
    filasIniciadas: { type: Number, default: 0 },
    /** Transacciones concluidas dentro del período. */
    ventasConcluidas: { type: Number, default: 0 },
    /** RQNF13.2 (KO6.1): ventas concluidas / filas iniciadas, en porcentaje. */
    tasaConcertacion: { type: Number, default: 0 },
    /** Tiempo promedio en fila (minutos) de sus productos; null si no hubo. */
    tiempoPromedioFilaMinutos: { type: Number, default: null },
  },
  { timestamps: true },
);

informeVendedorSchema.index({ vendedorId: 1, periodo: 1 }, { unique: true });

export const InformeVendedor = model("InformeVendedor", informeVendedorSchema);
