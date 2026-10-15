import { Router } from "express";
import {
  obtenerTodosLosUsuarios,
  suspenderUsuario,
  reactivarUsuario,
  obtenerReportesPendientes,
  resolverReporte,
  obtenerHistorialTransacciones,
  obtenerMensajesDeVenta,
  obtenerListaNegra,
  agregarEntradaListaNegra,
  quitarEntradaListaNegra,
  obtenerResumenAdmin,
} from "../controllers/adminController.js";
import { verificarToken } from "../middleware/auth.js";
import { esAdmin } from "../middleware/esAdmin.js";

const router = Router();

router.get("/resumen", verificarToken, esAdmin, obtenerResumenAdmin);

router.get("/usuarios", verificarToken, esAdmin, obtenerTodosLosUsuarios);

router.patch(
  "/usuarios/:id/suspender",
  verificarToken,
  esAdmin,
  suspenderUsuario,
);

router.patch(
  "/usuarios/:id/reactivar",
  verificarToken,
  esAdmin,
  reactivarUsuario,
);

router.get(
  "/reportes/pendientes",
  verificarToken,
  esAdmin,
  obtenerReportesPendientes,
);

router.patch(
  "/reportes/:id/resolver",
  verificarToken,
  esAdmin,
  resolverReporte,
);

router.get("/historial", verificarToken, esAdmin, obtenerHistorialTransacciones);

router.get(
  "/ventas/:ventaId/mensajes",
  verificarToken,
  esAdmin,
  obtenerMensajesDeVenta,
);

router.get("/lista-negra", verificarToken, esAdmin, obtenerListaNegra);

router.post(
  "/lista-negra",
  verificarToken,
  esAdmin,
  agregarEntradaListaNegra,
);

router.delete(
  "/lista-negra/:id",
  verificarToken,
  esAdmin,
  quitarEntradaListaNegra,
);

export default router;
