import { Schema, model } from "mongoose";

const colaSchema = new Schema(
  {
    productoId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    compradorId: { type: String, required: true },
    correo: { type: String },
    posicion: { type: Number, required: true },
    estado: {
      type: String,
      enum: [
        "activa",
        "esperando_confirmacion",
        "pagada",
        "reposo",
        "finalizada",
        // RQNF10.7: fila cancelada por la cancelación de la cuenta del vendedor.
        "cancelada",
      ],
      default: "activa",
    },
    // RQNF14.2: causa de cierre de la fila (tasa de abandono):
    //   salio_voluntariamente | turno_vencido | venta_completada |
    //   venta_cancelada | producto_eliminado | cuenta_cancelada
    motivoCierre: { type: String },
    pagoExpiraEn: { type: Date },
  },
  { timestamps: true },
);

export const Cola = model("Cola", colaSchema);
