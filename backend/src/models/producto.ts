import { Schema, model } from "mongoose";

export const CONDICIONES_PRODUCTO = [
  "nuevo",
  "usado-como-nuevo",
  "usado-buen-estado",
  "usado-aceptable",
] as const;

export const METODOS_ENTREGA = [
  "domicilio",
  "tienda",
  "punto-encuentro",
] as const;

export const TIEMPO_PAGO_MINIMO = 30;
export const TIEMPO_PAGO_MAXIMO = 180;
export const TIEMPO_PAGO_DEFECTO = 60;

const productoSchema = new Schema(
  {
    nombre: { type: String, required: true },
    precio: { type: Number, required: true },
    imagenes: { type: [String], required: true },
    categoria: { type: String, required: true },
    descripcion: { type: String, required: true },
    vendedor: { type: String, required: true },
    vendedorId: { type: Schema.Types.ObjectId, ref: "Usuario", required: true },
    condicion: { type: String, enum: CONDICIONES_PRODUCTO },
    metodoEntrega: { type: String, enum: METODOS_ENTREGA },
    horarioEntrega: {
      inicio: { type: String },
      fin: { type: String },
    },
    tiempoLimitePago: {
      type: Number,
      default: TIEMPO_PAGO_DEFECTO,
      min: [TIEMPO_PAGO_MINIMO, "El tiempo límite de pago es de 30 minutos como mínimo"],
      max: [TIEMPO_PAGO_MAXIMO, "El tiempo límite de pago es de 3 horas como máximo"],
    },
    datosDeEnvio: { type: String },
    activo: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const Producto = model("Product", productoSchema);
