import { Sancion } from "../models/Sancion.js";

export type EstadoBloqueo = {
  bloqueada: boolean;
  permanente: boolean;
  hasta: Date | null;
  faltasLeves: number;
  faltasGraves: number;
};

const MILIS_DIA = 24 * 60 * 60 * 1000;
const DIAS_BLOQUEO_PRIMERA_GRAVE = 30;
const DIAS_BLOQUEO_TRES_LEVES = 7;

/** Estado de bloqueo de una sanción (nula = sin sanciones). */
export function estadoBloqueo(sancion: any): EstadoBloqueo {
  const faltasLeves: number = sancion?.faltasLeves ?? 0;
  const faltasGraves: number = sancion?.faltasGraves ?? 0;
  const base = { faltasLeves, faltasGraves };

  if (!sancion) {
    return { bloqueada: false, permanente: false, hasta: null, ...base };
  }

  if (sancion.bloqueoPermanente) {
    return { bloqueada: true, permanente: true, hasta: null, ...base };
  }

  const hasta: Date | null = sancion.bloqueadoHasta
    ? new Date(sancion.bloqueadoHasta)
    : null;
  const activa = !!hasta && hasta.getTime() > Date.now();

  return {
    bloqueada: activa,
    permanente: false,
    hasta: activa ? hasta : null,
    ...base,
  };
}

export async function sancionDe(
  sujetoTipo: "usuario" | "comprador",
  sujetoId: string | undefined,
) {
  if (!sujetoId) return null;
  return Sancion.findOne({ sujetoTipo, sujetoId });
}

type FaltaARegistrar = {
  sujetoTipo: "usuario" | "comprador";
  sujetoId: string;
  reporteId: string;
  categoria: string;
  tipoFalta: "leve" | "grave";
  elemento: string;
  reportadoPor: string;
};

/** Nunca acorta un bloqueo vigente; solo lo extiende. */
function extenderBloqueo(sancion: any, dias: number) {
  if (sancion.bloqueoPermanente) return;
  const propuesto = new Date(Date.now() + dias * MILIS_DIA);
  if (!sancion.bloqueadoHasta || new Date(sancion.bloqueadoHasta) < propuesto) {
    sancion.bloqueadoHasta = propuesto;
  }
}

/**
 * Registra una falta por un reporte y aplica las reglas de reincidencia:
 * - 3 faltas leves  -> bloqueo de 7 días
 * - 1 falta grave   -> bloqueo de 30 días
 * - 2 faltas graves -> bloqueo permanente
 * Devuelve el estado de bloqueo resultante del sujeto.
 */
export async function registrarFalta(
  falta: FaltaARegistrar,
): Promise<EstadoBloqueo> {
  const sancion = await Sancion.findOneAndUpdate(
    { sujetoTipo: falta.sujetoTipo, sujetoId: falta.sujetoId },
    {
      $inc: {
        faltasLeves: falta.tipoFalta === "leve" ? 1 : 0,
        faltasGraves: falta.tipoFalta === "grave" ? 1 : 0,
      },
      $push: {
        historial: {
          reporteId: falta.reporteId,
          categoria: falta.categoria,
          tipoFalta: falta.tipoFalta,
          elemento: falta.elemento,
          reportadoPor: falta.reportadoPor,
          fecha: new Date(),
        },
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );

  if (falta.tipoFalta === "grave") {
    if (sancion.faltasGraves >= 2) {
      sancion.bloqueoPermanente = true;
    } else {
      extenderBloqueo(sancion, DIAS_BLOQUEO_PRIMERA_GRAVE);
    }
  } else if (sancion.faltasLeves >= 3) {
    extenderBloqueo(sancion, DIAS_BLOQUEO_TRES_LEVES);
  }

  await sancion.save();
  return estadoBloqueo(sancion);
}
