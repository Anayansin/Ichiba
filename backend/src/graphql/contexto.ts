import type { Request, Response } from "express";
import { verificarToken } from "../middleware/auth.js";
import type { RequestConUsuario } from "../middleware/auth.js";

export type ContextoGraphQL = {
  compradorId?: string;
  usuarioId?: string;
};

function obtenerUsuarioIdDesdeSolicitud(
  solicitud: Request,
): Promise<string | undefined> {
  if (!solicitud.headers.authorization) {
    return Promise.resolve(undefined);
  }

  return new Promise((resolver) => {
    const respuestaContextual = {
      status: () => ({
        json: () => resolver(undefined),
      }),
    } as unknown as Response;

    verificarToken(
      solicitud as RequestConUsuario,
      respuestaContextual,
      () => resolver((solicitud as RequestConUsuario).usuarioId),
    );
  });
}

export async function extraerContextoGraphQL(
  solicitud: Request,
): Promise<ContextoGraphQL> {
  const valorEncabezado = solicitud.headers["x-comprador-id"];
  const compradorId = Array.isArray(valorEncabezado)
    ? valorEncabezado[0]
    : valorEncabezado;
  const usuarioId = await obtenerUsuarioIdDesdeSolicitud(solicitud);
  return { compradorId, usuarioId };
}
