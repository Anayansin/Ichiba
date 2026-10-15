import { EventEmitter } from "events";
import clientePrisma from "../configuracion/prisma.js";
import { ListaNegra } from "../models/ListaNegra.js";
import { Disputa } from "../models/Disputa.js";
import {
  usuarioPublicado,
  type UsuarioPublicado,
  type UsuarioResumido,
} from "../services/resumenAdminService.js";

/**
 * Fase 4 — BackOffice en vivo con GraphQL Subscriptions.
 *
 * Pub/sub en proceso (sin dependencias extra): cada cambio relevante del
 * backoffice emite un evento en un canal y las suscripciones GraphQL activas
 * lo reciben al instante. El payload de `resumenAdmin` se recalcula fresco en
 * el resolver de la suscripción; los demás canales llevan el evento ya armado.
 *
 * Ninguna función de publicación puede tumbar la operación principal: si algo
 * falla al calcular o emitir, solo se registra en consola.
 */

export const CANAL_RESUMEN_ADMIN = "resumenAdmin";
export const CANAL_REPORTES_PENDIENTES = "reportesPendientes";
export const CANAL_USUARIOS_ADMIN = "usuariosAdmin";
export const CANAL_LISTA_NEGRA = "listaNegraActualizada";
// RQF40 / RQNF32: disputas de reembolso y retenciones preventivas.
export const CANAL_DISPUTAS = "disputasActualizadas";

export type TipoEventoReporte = "creado" | "resuelto" | "rechazado";
export type TipoEventoUsuario =
  | "registrado"
  | "suspendido"
  | "reactivado"
  | "puntos"
  | "cancelada"
  | "purgada"
  // RQNF33 / RQNF34 / RQNF35: faltas, bloqueos y revisiones administrativas.
  | "sancion"
  | "desbloqueado"
  // RQNF37 / RQNF38: adeudos del vendedor y sus liquidaciones.
  | "adeudo"
  | "adeudo_liquidado";
export type TipoEventoListaNegra = "agregada" | "quitada";
export type TipoEventoDisputa =
  | "abierta"
  | "respondida"
  | "reembolsada"
  | "rechazada"
  // RQNF32: retención preventiva puesta o retirada de una venta.
  | "retencion"
  | "retencion_liberada";

export type EventoReportePublicado = {
  tipo: TipoEventoReporte;
  mensaje: string;
  /** Reportes que siguen pendientes de revisión tras el cambio. */
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
  /** Entradas que tiene la lista negra tras el cambio. */
  entradas: number;
  generadoEn: string;
};

export type EventoDisputaPublicado = {
  tipo: TipoEventoDisputa;
  mensaje: string;
  /** Disputas que siguen abiertas tras el cambio. */
  abiertas: number;
  generadoEn: string;
};

type Oyente = (evento: unknown) => void;

const emisor = new EventEmitter();
// Sin límite de oyentes: cada pestaña del BackOffice es una suscripción.
emisor.setMaxListeners(0);

/**
 * Iterador asíncrono respaldado por el EventEmitter: es lo que consumen los
 * resolvers de `Subscription` para entregar cada evento al cliente.
 */
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

/** Señal de que el resumen del dashboard debe recalcularse. */
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

/** Evento de reportes: se creó uno nuevo o se resolvió/rechazó uno existente. */
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

/** Evento de usuarios: registro, suspensión, reactivación, puntos o purga. */
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

/** Evento de lista negra: entrada agregada o quitada. */
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

/**
 * RQF40 / RQNF32: evento de disputas y retenciones preventivas; incluye
 * cuántas disputas siguen abiertas tras el cambio.
 */
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
