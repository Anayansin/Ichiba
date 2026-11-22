import { Schema, model } from "mongoose";

const ejecucionTareaSchema = new Schema({
  nombre: { type: String, required: true, unique: true },
  ultimaEjecucion: { type: Date, required: true },
});

export const EjecucionTarea = model("EjecucionTarea", ejecucionTareaSchema);
