import { Request, Response } from "express";
import {
  ErrorBackoffice,
  agregarEntradaListaNegraAdmin,
  cambiarSuspensionUsuarioAdmin,
  historialTransaccionesAdmin,
  listarListaNegraAdmin,
  listarReportesPendientesAdmin,
  listarUsuariosAdmin,
  mensajesDeVentaAdmin,
  obtenerResumenAdmin as obtenerResumenAdminServicio,
  quitarEntradaListaNegraAdmin,
  resolverReporteAdmin,
} from "../services/backofficeService.js";

/**
 * Endpoints REST del BackOffice (`/api/admin/*`).
 *
 * Toda la lógica vive en `backofficeService` porque la comparten los endpoints
 * REST, las suscripciones GraphQL y el servidor MCP. Aquí solo se traduce la
 * petición HTTP a la llamada del servicio y sus errores al código de estado.
 */

function responderError(
  res: Response,
  error: unknown,
  mensajeGenerico: string,
) {
  if (error instanceof ErrorBackoffice) {
    return res.status(error.estado).json({ message: error.message });
  }

  console.error("Error real:", error);
  res.status(500).json({ message: mensajeGenerico });
}

export async function obtenerTodosLosUsuarios(req: Request, res: Response) {
  try {
    const resultado = await listarUsuariosAdmin({
      pagina: Number(req.query.pagina),
      porPagina: Number(req.query.porPagina),
    });
    res.json(resultado);
  } catch (error) {
    responderError(res, error, "Error al obtener los usuarios");
  }
}

export async function suspenderUsuario(req: Request, res: Response) {
  try {
    res.json(await cambiarSuspensionUsuarioAdmin(String(req.params.id), true));
  } catch (error) {
    responderError(res, error, "Error al actualizar el usuario");
  }
}

export async function reactivarUsuario(req: Request, res: Response) {
  try {
    res.json(await cambiarSuspensionUsuarioAdmin(String(req.params.id), false));
  } catch (error) {
    responderError(res, error, "Error al actualizar el usuario");
  }
}

export async function obtenerReportesPendientes(_req: Request, res: Response) {
  try {
    res.json(await listarReportesPendientesAdmin());
  } catch (error) {
    responderError(res, error, "Error al obtener los reportes pendientes");
  }
}

export async function resolverReporte(req: Request, res: Response) {
  try {
    res.json(await resolverReporteAdmin(req.params.id, req.body?.resultado));
  } catch (error) {
    responderError(res, error, "Error al resolver el reporte");
  }
}

export async function obtenerHistorialTransacciones(
  _req: Request,
  res: Response,
) {
  try {
    res.json(await historialTransaccionesAdmin());
  } catch (error) {
    responderError(
      res,
      error,
      "Error al obtener el historial de transacciones",
    );
  }
}

export async function obtenerMensajesDeVenta(req: Request, res: Response) {
  try {
    res.json(await mensajesDeVentaAdmin(String(req.params.ventaId)));
  } catch (error) {
    responderError(res, error, "Error al obtener los mensajes de la venta");
  }
}

export async function obtenerListaNegra(req: Request, res: Response) {
  try {
    res.json(
      await listarListaNegraAdmin({
        pagina: Number(req.query.pagina),
        porPagina: Number(req.query.porPagina),
      }),
    );
  } catch (error) {
    responderError(res, error, "Error al obtener la lista negra");
  }
}

export async function agregarEntradaListaNegra(req: Request, res: Response) {
  try {
    const entrada = await agregarEntradaListaNegraAdmin(req.body ?? {});
    res.status(201).json(entrada);
  } catch (error) {
    responderError(
      res,
      error,
      "No se pudo agregar el registro a la lista negra",
    );
  }
}

export async function quitarEntradaListaNegra(req: Request, res: Response) {
  try {
    await quitarEntradaListaNegraAdmin(String(req.params.id));
    res.json({ message: "Registro eliminado de la lista negra" });
  } catch (error) {
    responderError(
      res,
      error,
      "No se pudo eliminar el registro de la lista negra",
    );
  }
}

/**
 * Dashboard del administrador: el cálculo vive en `resumenAdminService`
 * porque también lo usa la suscripción GraphQL `resumenAdmin` (Fase 4) y la
 * herramienta MCP `resumen_backoffice`.
 */
export async function obtenerResumenAdmin(_req: Request, res: Response) {
  try {
    res.json(await obtenerResumenAdminServicio());
  } catch (error) {
    responderError(res, error, "No se pudo cargar el resumen");
  }
}
