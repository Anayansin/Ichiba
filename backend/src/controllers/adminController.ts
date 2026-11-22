import { Request, Response } from "express";
import {
  ErrorBackoffice,
  agregarEntradaListaNegraAdmin,
  agregarUsuarioAListaNegraAdmin,
  cambiarSuspensionUsuarioAdmin,
  historialTransaccionesAdmin,
  listarAdeudosAdmin,
  listarDisputasAdmin,
  listarListaNegraAdmin,
  listarReportesPendientesAdmin,
  listarSolicitudesRegistroAdmin,
  listarUsuariosAdmin,
  liquidarAdeudoAdmin,
  mensajesDeVentaAdmin,
  obtenerResumenAdmin as obtenerResumenAdminServicio,
  quitarEntradaListaNegraAdmin,
  resolverDisputaAdmin,
  resolverReporteAdmin,
  resolverSolicitudRegistroAdmin,
  resolverVentaRetenidaAdmin,
} from "../services/backofficeService.js";
import { RequestConUsuario } from "../middleware/auth.js";
import { consultarBitacora } from "../services/bitacoraService.js";

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
      busqueda: typeof req.query.busqueda === "string" ? req.query.busqueda : undefined,
    });
    res.json(resultado);
  } catch (error) {
    responderError(res, error, "Error al obtener los usuarios");
  }
}

export async function suspenderUsuario(req: Request, res: Response) {
  try {
    res.json(
      await cambiarSuspensionUsuarioAdmin(
        String(req.params.id),
        true,
        typeof req.body?.motivo === "string" ? req.body.motivo : undefined,
      ),
    );
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

export async function agregarUsuarioAListaNegra(req: Request, res: Response) {
  try {
    const entrada = await agregarUsuarioAListaNegraAdmin(
      String(req.params.id),
      typeof req.body?.motivo === "string" ? req.body.motivo : undefined,
    );
    res.status(201).json({
      message: "Usuario agregado a la lista negra",
      entrada,
    });
  } catch (error) {
    responderError(
      res,
      error,
      "No se pudo agregar el usuario a la lista negra",
    );
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

export async function obtenerSolicitudesRegistro(req: Request, res: Response) {
  try {
    res.json(
      await listarSolicitudesRegistroAdmin({
        pagina: Number(req.query.pagina),
        porPagina: Number(req.query.porPagina),
        estado: typeof req.query.estado === "string" ? req.query.estado : undefined,
      }),
    );
  } catch (error) {
    responderError(res, error, "Error al obtener las solicitudes de registro");
  }
}

export async function resolverSolicitudRegistro(
  req: RequestConUsuario,
  res: Response,
) {
  try {
    const { estado, respuesta } = req.body ?? {};

    if (!["en-revision", "resuelta", "descartada"].includes(estado)) {
      throw new ErrorBackoffice(
        400,
        "Indica si la solicitud queda en revisión, resuelta o descartada",
      );
    }

    const solicitud = await resolverSolicitudRegistroAdmin(
      String(req.params.id),
      {
        estado,
        respuesta: typeof respuesta === "string" ? respuesta : "",
        revisadaPor: String(req.usuarioId ?? ""),
      },
    );

    res.json({ message: "Solicitud atendida", solicitud });
  } catch (error) {
    responderError(res, error, "No se pudo atender la solicitud");
  }
}

export async function obtenerResumenAdmin(_req: Request, res: Response) {
  try {
    res.json(await obtenerResumenAdminServicio());
  } catch (error) {
    responderError(res, error, "No se pudo cargar el resumen");
  }
}

function idAdmin(req: RequestConUsuario): number | null {
  const id = Number(req.usuarioId);
  return Number.isInteger(id) ? id : null;
}

export async function obtenerDisputas(req: Request, res: Response) {
  try {
    res.json(
      await listarDisputasAdmin({
        pagina: Number(req.query.pagina),
        porPagina: Number(req.query.porPagina),
        estado:
          typeof req.query.estado === "string" ? req.query.estado : undefined,
      }),
    );
  } catch (error) {
    responderError(res, error, "Error al obtener las disputas");
  }
}

export async function resolverDisputa(req: RequestConUsuario, res: Response) {
  try {
    res.json(
      await resolverDisputaAdmin(String(req.params.id), req.body?.dictamen, {
        nota: typeof req.body?.nota === "string" ? req.body.nota : undefined,
        adminId: idAdmin(req),
      }),
    );
  } catch (error) {
    responderError(res, error, "Error al resolver la disputa");
  }
}

export async function resolverVentaRetenida(
  req: RequestConUsuario,
  res: Response,
) {
  try {
    res.json(
      await resolverVentaRetenidaAdmin(String(req.params.ventaId), {
        dictamen: req.body?.dictamen,
        causaAdeudo: req.body?.causaAdeudo,
        nota: typeof req.body?.nota === "string" ? req.body.nota : undefined,
        adminId: idAdmin(req),
      }),
    );
  } catch (error) {
    responderError(res, error, "Error al resolver la venta retenida");
  }
}

export async function obtenerAdeudos(req: Request, res: Response) {
  try {
    res.json(
      await listarAdeudosAdmin({
        pagina: Number(req.query.pagina),
        porPagina: Number(req.query.porPagina),
        estado:
          typeof req.query.estado === "string" ? req.query.estado : undefined,
        usuarioId:
          req.query.usuarioId !== undefined
            ? Number(req.query.usuarioId)
            : undefined,
      }),
    );
  } catch (error) {
    responderError(res, error, "Error al obtener los adeudos");
  }
}

export async function liquidarAdeudo(req: RequestConUsuario, res: Response) {
  try {
    res.json(
      await liquidarAdeudoAdmin(String(req.params.id), {
        nota: typeof req.body?.nota === "string" ? req.body.nota : undefined,
        adminId: idAdmin(req),
      }),
    );
  } catch (error) {
    responderError(res, error, "Error al liquidar el adeudo");
  }
}

export async function obtenerBitacora(req: Request, res: Response) {
  try {
    res.json(
      await consultarBitacora({
        accion: typeof req.query.accion === "string" ? req.query.accion : undefined,
        actor: typeof req.query.actor === "string" ? req.query.actor.trim() : undefined,
        limite: Number(req.query.limite),
      }),
    );
  } catch (error) {
    responderError(res, error, "Error al obtener la bitácora de acciones");
  }
}
