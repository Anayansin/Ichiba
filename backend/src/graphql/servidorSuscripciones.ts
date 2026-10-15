import type { Server as ServidorHttp } from "http";
import { WebSocketServer } from "ws";
import { useServer } from "graphql-ws/use/ws";
import type { GraphQLSchema } from "graphql";
import jwt from "jsonwebtoken";
import { buscarUsuarioPorId } from "../services/usuarioService.js";

/**
 * Fase 4 — suscripciones GraphQL del BackOffice.
 *
 * Monta un servidor WebSocket (protocolo `graphql-transport-ws`) sobre el
 * mismo servidor HTTP y en la misma ruta que GraphQL (`/graphql`), para que
 * el cliente use `ws(s)://…/graphql`. Solo se admiten administradores: el
 * token viaja en `connectionParams.Authorization` y se valida contra la base
 * de datos igual que `esAdmin` en las rutas REST.
 */

type ParametrosConexion = Record<string, unknown> | undefined;

function tokenDeParametros(parametros: ParametrosConexion): string | null {
  const autorizacion =
    parametros?.Authorization ?? parametros?.authorization ?? null;
  if (typeof autorizacion !== "string" || !autorizacion.trim()) return null;

  const token = autorizacion.replace(/^Bearer\s+/i, "").trim();
  return token || null;
}

/**
 * Devuelve el id del administrador autenticado o `null` si el token falta,
 * es inválido, está vencido o la cuenta no es de tipo admin.
 */
async function autenticarAdministrador(
  parametros: ParametrosConexion,
): Promise<number | null> {
  const token = tokenDeParametros(parametros);
  if (!token) return null;

  let payload: { id?: unknown };
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET as string) as {
      id?: unknown;
    };
  } catch {
    return null;
  }

  const id = Number(payload?.id);
  if (!Number.isInteger(id)) return null;

  const usuario = await buscarUsuarioPorId(id);
  if (!usuario || usuario.tipo !== "admin") return null;

  return id;
}

export function iniciarServidorDeSuscripciones(
  servidorHttp: ServidorHttp,
  esquema: GraphQLSchema,
): WebSocketServer {
  const servidorWs = new WebSocketServer({
    server: servidorHttp,
    path: "/graphql",
  });

  const limpieza = useServer(
    {
      schema: esquema,
      // Solo administradores: sin token o con cuenta que no sea admin la
      // conexión se rechaza con el cierre 4403 (Forbidden).
      onConnect: async (contexto) => {
        const usuarioId = await autenticarAdministrador(
          contexto.connectionParams as ParametrosConexion,
        );
        if (usuarioId === null) return false;
        return { usuarioId };
      },
      context: async (contexto) => {
        const usuarioId = await autenticarAdministrador(
          contexto.connectionParams as ParametrosConexion,
        );
        if (usuarioId === null) {
          throw new Error("Se requiere acceso de administrador");
        }
        return { usuarioId };
      },
    },
    servidorWs,
  );

  servidorHttp.on("close", () => {
    void limpieza.dispose();
  });

  console.log(
    "Suscripciones GraphQL listas: WebSocket en la misma ruta /graphql y puerto que la API",
  );
  return servidorWs;
}
