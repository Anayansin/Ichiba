import { EventEmitter } from "events";
import clientePrisma from "../configuracion/prisma.js";
import { ListaNegra } from "../models/ListaNegra.js";
import { Disputa } from "../models/Disputa.js";
import { SolicitudRegistroBloqueado } from "../models/SolicitudRegistroBloqueado.js";
import {
  usuarioPublicado,
  type UsuarioPublicado,
  type UsuarioResumido,
} from "../services/resumenAdminService.js";

export const CANAL_RESUMEN_ADMIN = "resumenAdmin";
export const CANAL_REPORTES_PENDIENTES = "reportesPendientes";
export const CANAL_USUARIOS_ADMIN = "usuariosAdmin";
export const CANAL_LISTA_NEGRA = "listaNegraActualizada";
export const CANAL_SOLICITUDES_REGISTRO = "solicitudesRegistro";
export const CANAL_DISPUTAS = "disputasActualizadas";

export type TipoEventoReporte = "creado" | "resuelto" | "rechazado";
export type TipoEventoUsuario =
  | "registrado"
  | "suspendido"
  | "reactivado"
  | "puntos"
  | "cancelada"
  | "purgada"
  | "sancion"
  | "desbloqueado"
  | "adeudo"
  | "adeudo_liquidado";
export type TipoEventoListaNegra = "agregada" | "quitada";
export type TipoEventoDisputa =
  | "abierta"
  | "respondida"
  | "reembolsada"
  | "rechazada"
  | "retencion"
  | "retencion_liberada";

export type EventoReportePublicado = {
  tipo: TipoEventoReporte;
  mensaje: string;
  pendientes: number;
  generadoEn: string;
};

export type EventoUsuarioPublicado = {
  tipo: TipoEventoUsuario;
  mensaje: string;
  usuario: UsuarioPublicado | null;
  generadoEn: string;
};

export type EventoListaNegraPublicado = {
  tipo: TipoEventoListaNegra;
  mensaje: string;
  entradas: number;
  generadoEn: string;
};

export type EventoDisputaPublicado = {
  tipo: TipoEventoDisputa;
  mensaje: string;
  abiertas: number;
  generadoEn: string;
};

export type EventoSolicitudRegistroPublicado = {
  tipo: "creada" | "revisada";
  mensaje: string;
  pendientes: number;
  generadoEn: string;
};

type Oyente = (evento: unknown) => void;

const emisor = new EventEmitter();
emisor.setMaxListeners(0);

export function suscribirseAlCanal(canal: string): AsyncIterableIterator<unknown> {
  const pendientes: unknown[] = [];
  let resolverSiguiente:
    | ((resultado: IteratorResult<unknown>) => void)
    | null = null;
  let terminado = false;

  const manejarEvento: Oyente = (evento) => {
    if (terminado) return;

    if (resolverSiguiente) {
      const resolver = resolverSiguiente;
      resolverSiguiente = null;
      resolver({ value: evento, done: false });
    } else {
      pendientes.push(evento);
    }
  };

  emisor.on(canal, manejarEvento);

  return {
    [Symbol.asyncIterator]() {
      return this;
    },
    next(): Promise<IteratorResult<unknown>> {
      if (pendientes.length > 0) {
        return Promise.resolve({ value: pendientes.shift(), done: false });
      }
      if (terminado) {
        return Promise.resolve({ value: undefined, done: true });
      }
      return new Promise((resolver) => {
        resolverSiguiente = resolver;
      });
    },
    return(): Promise<IteratorResult<unknown>> {
      terminado = true;
      emisor.off(canal, manejarEvento);
      return Promise.resolve({ value: undefined, done: true });
    },
  };
}

export function publicarResumenAdmin(): void {
  try {
    emisor.emit(CANAL_RESUMEN_ADMIN, {
      generadoEn: new Date().toISOString(),
    });
  } catch (error) {
    console.error(
      "[suscripciones] No se pudo publicar el resumen:",
      error instanceof Error ? error.message : error,
    );
  }
}

export async function publicarReportesPendientes(
  tipo: TipoEventoReporte,
  mensaje: string,
): Promise<void> {
  try {
    const pendientes = await clientePrisma.reporte.count({
      where: { estado: "pendiente" },
    });
    emisor.emit(CANAL_REPORTES_PENDIENTES, {
      tipo,
      mensaje,
      pendientes,
      generadoEn: new Date().toISOString(),
    } satisfies EventoReportePublicado);
  } catch (error) {
    console.error(
      "[suscripciones] No se pudo publicar el evento de reportes:",
      error instanceof Error ? error.message : error,
    );
  }
}

export async function publicarEventoUsuario(
  tipo: TipoEventoUsuario,
  mensaje: string,
  usuario: UsuarioResumido | null,
): Promise<void> {
  try {
    emisor.emit(CANAL_USUARIOS_ADMIN, {
      tipo,
      mensaje,
      usuario: usuario ? usuarioPublicado(usuario) : null,
      generadoEn: new Date().toISOString(),
    } satisfies EventoUsuarioPublicado);
  } catch (error) {
    console.error(
      "[suscripciones] No se pudo publicar el evento de usuarios:",
      error instanceof Error ? error.message : error,
    );
  }
}

export async function publicarListaNegraActualizada(
  tipo: TipoEventoListaNegra,
  mensaje: string,
): Promise<void> {
  try {
    const entradas = await ListaNegra.countDocuments();
    emisor.emit(CANAL_LISTA_NEGRA, {
      tipo,
      mensaje,
      entradas,
      generadoEn: new Date().toISOString(),
    } satisfies EventoListaNegraPublicado);
  } catch (error) {
    console.error(
      "[suscripciones] No se pudo publicar el evento de lista negra:",
      error instanceof Error ? error.message : error,
    );
  }
}

export async function publicarDisputasActualizadas(
  tipo: TipoEventoDisputa,
  mensaje: string,
): Promise<void> {
  try {
    const abiertas = await Disputa.countDocuments({ estado: "abierta" });
    emisor.emit(CANAL_DISPUTAS, {
      tipo,
      mensaje,
      abiertas,
      generadoEn: new Date().toISOString(),
    } satisfies EventoDisputaPublicado);
  } catch (error) {
    console.error(
      "[suscripciones] No se pudo publicar el evento de disputas:",
      error instanceof Error ? error.message : error,
    );
  }
}

export async function publicarSolicitudRevisionRegistrada(
  solicitud: {
    id: string;
    correo: string;
    nombreCompleto: string;
    estado?: string;
  },
  tipo: "creada" | "revisada" = "creada",
): Promise<void> {
  try {
    const pendientes = await SolicitudRegistroBloqueado.countDocuments({
      estado: { $in: ["pendiente", "en-revision"] },
    });
    emisor.emit(CANAL_SOLICITUDES_REGISTRO, {
      tipo,
      mensaje:
        tipo === "creada"
          ? `Solicitud de revisión de registro: ${solicitud.nombreCompleto} (${solicitud.correo})`
          : `Solicitud de revisión atendida: ${solicitud.nombreCompleto} (${solicitud.correo})`,
      pendientes,
      generadoEn: new Date().toISOString(),
    } satisfies EventoSolicitudRegistroPublicado);
  } catch (error) {
    console.error(
      "[suscripciones] No se pudo publicar el evento de solicitudes de registro:",
      error instanceof Error ? error.message : error,
    );
  }
}
