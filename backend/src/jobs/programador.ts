import { EjecucionTarea } from "../models/EjecucionTarea.js";
import { revisarTurnosDePago } from "./revisionPagos.js";
import { revisarEntregasVencidas } from "./revisionEntregas.js";
import { revisarSanciones } from "./revisionSanciones.js";
import { revisarHorariosDeVendedores } from "./revisionHorarios.js";
import { enviarNovedadesDeCategorias } from "./notificacionesCategoria.js";
import { ejecutarRevisionMensual } from "./informesMensuales.js";

const MINUTO = 60 * 1000;
const DESFASE_ZONA_CENTRO = 6 * 60 * MINUTO;

function enZonaCentro(fecha: Date): Date {
  return new Date(fecha.getTime() - DESFASE_ZONA_CENTRO);
}

function desdeZonaCentro(anio: number, mes: number, dia: number, hora: number, minuto = 0): Date {
  return new Date(Date.UTC(anio, mes, dia, hora, minuto) + DESFASE_ZONA_CENTRO);
}

function ultimoHorarioDiario(ahora: Date, horas: number[], minuto = 0): Date {
  const reloj = enZonaCentro(ahora);
  const candidatos: Date[] = [];
  for (const diasAtras of [0, 1]) {
    for (const hora of horas) {
      candidatos.push(
        desdeZonaCentro(
          reloj.getUTCFullYear(),
          reloj.getUTCMonth(),
          reloj.getUTCDate() - diasAtras,
          hora,
          minuto,
        ),
      );
    }
  }
  return candidatos
    .filter((fecha) => fecha.getTime() <= ahora.getTime())
    .sort((a, b) => b.getTime() - a.getTime())[0];
}

function ultimoPrimeroDeMes(ahora: Date): Date {
  const reloj = enZonaCentro(ahora);
  const esteMes = desdeZonaCentro(reloj.getUTCFullYear(), reloj.getUTCMonth(), 1, 0, 5);
  if (esteMes.getTime() <= ahora.getTime()) return esteMes;
  return desdeZonaCentro(reloj.getUTCFullYear(), reloj.getUTCMonth() - 1, 1, 0, 5);
}

type Tarea = {
  nombre: string;
  turnoVigente: (ahora: Date) => Date;
  ejecutar: (ejecucionAnterior: Date | null, ahora: Date) => Promise<void>;
};

const TAREAS: Tarea[] = [
  {
    nombre: "turnos-de-pago",
    turnoVigente: (ahora) => new Date(Math.floor(ahora.getTime() / MINUTO) * MINUTO),
    ejecutar: () => revisarTurnosDePago(),
  },
  {
    nombre: "entregas-vencidas",
    turnoVigente: (ahora) => new Date(Math.floor(ahora.getTime() / MINUTO) * MINUTO),
    ejecutar: async () => {
      for (const accion of await revisarEntregasVencidas()) {
        console.log(`[escrow] ${accion}`);
      }
    },
  },
  {
    nombre: "sanciones",
    turnoVigente: (ahora) =>
      new Date(Math.floor(ahora.getTime() / (5 * MINUTO)) * 5 * MINUTO),
    ejecutar: async () => {
      for (const accion of await revisarSanciones()) {
        console.log(`[sanciones] ${accion}`);
      }
    },
  },
  {
    nombre: "horarios-vendedores",
    turnoVigente: (ahora) => ultimoHorarioDiario(ahora, [8]),
    ejecutar: () => revisarHorariosDeVendedores(),
  },
  {
    nombre: "novedades-categorias",
    turnoVigente: (ahora) => ultimoHorarioDiario(ahora, [10, 17]),
    ejecutar: (anterior, ahora) =>
      enviarNovedadesDeCategorias(
        anterior ?? new Date(ahora.getTime() - 24 * 60 * MINUTO),
      ),
  },
  {
    nombre: "informes-mensuales",
    turnoVigente: (ahora) => ultimoPrimeroDeMes(ahora),
    ejecutar: async () => {
      for (const accion of await ejecutarRevisionMensual()) {
        console.log(`[informes] ${accion}`);
      }
    },
  },
];

async function reclamarTurno(
  nombre: string,
  turno: Date,
  ahora: Date,
): Promise<{ reclamado: boolean; anterior: Date | null }> {
  try {
    const previo = await EjecucionTarea.findOneAndUpdate(
      { nombre, ultimaEjecucion: { $lt: turno } },
      { $set: { ultimaEjecucion: ahora } },
      { new: false },
    ).lean();
    if (previo) return { reclamado: true, anterior: previo.ultimaEjecucion };

    const existente = await EjecucionTarea.exists({ nombre });
    if (existente) return { reclamado: false, anterior: null };

    await EjecucionTarea.create({ nombre, ultimaEjecucion: ahora });
    return { reclamado: true, anterior: null };
  } catch (error) {
    if ((error as { code?: number })?.code === 11000) {
      return { reclamado: false, anterior: null };
    }
    throw error;
  }
}

let ejecutando: Promise<string[]> | null = null;
let ultimaRevision = 0;

async function revisarTareas(): Promise<string[]> {
  const ahora = new Date();
  const ejecutadas: string[] = [];

  for (const tarea of TAREAS) {
    try {
      const turno = tarea.turnoVigente(ahora);
      const { reclamado, anterior } = await reclamarTurno(tarea.nombre, turno, ahora);
      if (!reclamado) continue;
      await tarea.ejecutar(anterior, ahora);
      ejecutadas.push(tarea.nombre);
    } catch (error) {
      console.error(`[tareas] Falló la tarea ${tarea.nombre}:`, error);
    }
  }

  return ejecutadas;
}

export function ejecutarTareasPendientes(): Promise<string[]> {
  if (!ejecutando) {
    ultimaRevision = Date.now();
    ejecutando = revisarTareas().finally(() => {
      ejecutando = null;
    });
  }
  return ejecutando;
}

export function tareasPorRevisar(): boolean {
  return !ejecutando && Date.now() - ultimaRevision >= MINUTO;
}
