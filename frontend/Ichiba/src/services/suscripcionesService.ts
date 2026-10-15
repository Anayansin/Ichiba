import { createClient } from "graphql-ws";
import { URL_BACKEND } from "./api";

/**
 * Fase 4 — BackOffice en vivo con GraphQL Subscriptions.
 *
 * Abre una conexión WebSocket al mismo backend y ruta que GraphQL
 * (`/graphql`) enviando el token del administrador en `connectionParams`;
 * el servidor solo acepta administradores. Devuelve una función para cerrar
 * la suscripción y liberar la conexión (se usa al desmontar el componente).
 */

function urlDeSuscripciones(): string {
  const url = new URL(URL_BACKEND);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/graphql";
  url.search = "";
  url.hash = "";
  return url.toString();
}

export function suscribirse<T>(
  consulta: string,
  campo: string,
  alRecibir: (dato: T) => void,
  alFallar?: (error: unknown) => void,
): () => void {
  const token = localStorage.getItem("token");
  const cliente = createClient({
    url: urlDeSuscripciones(),
    connectionParams: token ? { Authorization: `Bearer ${token}` } : {},
    retryAttempts: 5,
  });

  const cerrar = cliente.subscribe(
    { query: consulta },
    {
      next: (resultado) => {
        const datos = resultado.data as
          | Record<string, unknown>
          | undefined;
        if (datos && campo in datos) {
          alRecibir(datos[campo] as T);
        }
      },
      error: (error) => alFallar?.(error),
      complete: () => {},
    },
  );

  return () => {
    cerrar();
    void cliente.dispose();
  };
}

export type EventoReporte = {
  tipo: string;
  mensaje: string;
  pendientes: number;
  generadoEn: string;
};

export type EventoUsuario = {
  tipo: string;
  mensaje: string;
  usuario: {
    id: string;
    nombreCompleto: string;
    correo: string;
    tipo: string;
    suspendido: boolean;
    puntosReputacion: number;
    estadoCuenta: string;
    fechaRegistro: string | null;
  } | null;
  generadoEn: string;
};

export type EventoListaNegra = {
  tipo: string;
  mensaje: string;
  entradas: number;
  generadoEn: string;
};
