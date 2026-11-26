import { Router, type Request, type Response } from "express";
import { verificarToken } from "../middleware/auth.js";
import { esAdmin } from "../middleware/esAdmin.js";
import { ErrorBackoffice } from "../services/errorBackoffice.js";
import {
  listarPublicacionesAdmin,
  editarPublicacionAdmin,
  detalleUsuarioAdmin,
  editarUsuarioAdmin,
  listarTransaccionesAdmin,
  listarConversacionesAdmin,
  detalleConversacionAdmin,
  listarQuejasAdmin,
  actualizarQuejaAdmin,
  listarTodosLosReportesAdmin,
} from "../services/adminTotalService.js";

const router = Router();
router.use(verificarToken, esAdmin);

function texto(valor: unknown): string | undefined {
  return typeof valor === "string" && valor.trim() ? valor.trim() : undefined;
}

function responder(
  accion: (req: Request) => Promise<unknown>,
  mensajeError: string,
) {
  return async (req: Request, res: Response) => {
    try {
      res.json(await accion(req));
    } catch (error) {
      if (error instanceof ErrorBackoffice) {
        return res.status(error.estado).json({ message: error.message });
      }
      console.error(`[admin] ${mensajeError}:`, error);
      res.status(500).json({ message: mensajeError });
    }
  };
}

router.get(
  "/publicaciones",
  responder(
    (req) =>
      listarPublicacionesAdmin({
        q: texto(req.query.q),
        tipo: texto(req.query.tipo),
        estado: texto(req.query.estado),
        pagina: Number(req.query.pagina),
      }),
    "Error al obtener las publicaciones",
  ),
);

router.patch(
  "/publicaciones/:tipo/:id",
  responder(
    (req) =>
      editarPublicacionAdmin(
        String(req.params.tipo),
        String(req.params.id),
        req.body ?? {},
      ),
    "Error al guardar la publicación",
  ),
);

router.get(
  "/usuarios/:id/detalle",
  responder(
    (req) => detalleUsuarioAdmin(String(req.params.id)),
    "Error al obtener el usuario",
  ),
);

router.patch(
  "/usuarios/:id/datos",
  responder(
    (req) => editarUsuarioAdmin(String(req.params.id), req.body ?? {}),
    "Error al guardar el usuario",
  ),
);

router.get(
  "/transacciones",
  responder(
    (req) =>
      listarTransaccionesAdmin({
        q: texto(req.query.q),
        estado: texto(req.query.estado),
        problema: req.query.problema === "1",
        pagina: Number(req.query.pagina),
      }),
    "Error al obtener las transacciones",
  ),
);

router.get(
  "/conversaciones",
  responder(
    (req) =>
      listarConversacionesAdmin({
        q: texto(req.query.q),
        tipo: texto(req.query.tipo),
        problema: req.query.problema === "1",
        pagina: Number(req.query.pagina),
      }),
    "Error al obtener las conversaciones",
  ),
);

router.get(
  "/conversaciones/:tipo/:id",
  responder(
    (req) =>
      detalleConversacionAdmin(String(req.params.tipo), String(req.params.id)),
    "Error al obtener la conversación",
  ),
);

router.get(
  "/quejas",
  responder(
    (req) =>
      listarQuejasAdmin({
        q: texto(req.query.q),
        estado: texto(req.query.estado),
        pagina: Number(req.query.pagina),
      }),
    "Error al obtener las quejas",
  ),
);

router.patch(
  "/quejas/:id",
  responder(
    (req) => actualizarQuejaAdmin(String(req.params.id), req.body ?? {}),
    "Error al actualizar la queja",
  ),
);

router.get(
  "/reportes/todos",
  responder(
    (req) =>
      listarTodosLosReportesAdmin({
        q: texto(req.query.q),
        estado: texto(req.query.estado),
        pagina: Number(req.query.pagina),
      }),
    "Error al obtener los reportes",
  ),
);

export default router;
