import { Router } from "express";
import {
  obtenerTodosLosUsuarios,
  suspenderUsuario,
  reactivarUsuario,
  agregarUsuarioAListaNegra,
  obtenerReportesPendientes,
  resolverReporte,
  obtenerHistorialTransacciones,
  obtenerMensajesDeVenta,
  obtenerListaNegra,
  agregarEntradaListaNegra,
  quitarEntradaListaNegra,
  obtenerSolicitudesRegistro,
  resolverSolicitudRegistro,
  obtenerResumenAdmin,
  obtenerDisputas,
  resolverDisputa,
  resolverVentaRetenida,
  obtenerAdeudos,
  liquidarAdeudo,
} from "../controllers/adminController.js";
import {
  listarInformesGlobales,
  descargarInformeGlobal,
  generarInformesAdmin,
} from "../controllers/informeController.js";
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

router.post(
  "/usuarios/:id/lista-negra",
  verificarToken,
  esAdmin,
  agregarUsuarioAListaNegra,
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

router.get(
  "/solicitudes-registro",
  verificarToken,
  esAdmin,
  obtenerSolicitudesRegistro,
);

router.post(
  "/solicitudes-registro/:id/resolver",
  verificarToken,
  esAdmin,
  resolverSolicitudRegistro,
);

router.get("/disputas", verificarToken, esAdmin, obtenerDisputas);

router.post(
  "/disputas/:id/resolver",
  verificarToken,
  esAdmin,
  resolverDisputa,
);

router.post(
  "/ventas-retenidas/:ventaId/resolver",
  verificarToken,
  esAdmin,
  resolverVentaRetenida,
);

router.get("/adeudos", verificarToken, esAdmin, obtenerAdeudos);

router.post(
  "/adeudos/:id/liquidar",
  verificarToken,
  esAdmin,
  liquidarAdeudo,
);

router.get("/informes", verificarToken, esAdmin, listarInformesGlobales);

router.post("/informes/generar", verificarToken, esAdmin, generarInformesAdmin);

router.get(
  "/informes/:periodo/pdf",
  verificarToken,
  esAdmin,
  descargarInformeGlobal,
);

export default router;
