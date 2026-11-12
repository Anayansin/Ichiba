import { Schema, model } from "mongoose";

/**
 * Solicitud de revisión de un registro que el sistema bloqueó.
 *
 * Cuando alguien intenta crear una cuenta con datos que están en la lista
 * negra o que ya pertenecen a otra cuenta, el registro se deniega. Si la
 * persona cree que se trata de un error, desde el formulario de registro
 * puede enviar una solicitud: aquí queda registrada y los administradores la
 * revisan desde el BackOffice.
 *
 * No se guardan documentos oficiales ni CURP: solo los datos que la persona
 * escribió en el formulario.
 */
const solicitudRegistroBloqueadoSchema = new Schema(
  {
    nombreCompleto: { type: String, required: true, trim: true },
    correo: { type: String, required: true, trim: true, lowercase: true },
    telefono: { type: String, trim: true, default: "" },
    rfc: { type: String, trim: true, default: "" },
    /** "lista-negra" | "datos-en-uso" | "correo-en-uso". */
    motivoBloqueo: { type: String, required: true },
    /** Campos que coincidieron, para que el administrador sepa qué revisar. */
    camposCoincidentes: { type: [String], default: [] },
    /** Lo que escribió la persona para explicar el caso. */
    mensaje: { type: String, trim: true, default: "" },
    /** "pendiente" | "en-revision" | "resuelta" | "descartada". */
    estado: {
      type: String,
      enum: ["pendiente", "en-revision", "resuelta", "descartada"],
      default: "pendiente",
    },
    /** Respuesta del administrador para la persona. */
    respuesta: { type: String, trim: true, default: "" },
    revisadaPor: { type: String, trim: true, default: "" },
    revisadaEn: { type: Date },
  },
  { timestamps: true },
);

// Las solicitudes pendientes se revisan primero; las viejas se conservan.
solicitudRegistroBloqueadoSchema.index({ estado: 1, createdAt: -1 });
solicitudRegistroBloqueadoSchema.index({ correo: 1, createdAt: -1 });

export const SolicitudRegistroBloqueado = model(
  "SolicitudRegistroBloqueado",
  solicitudRegistroBloqueadoSchema,
);
