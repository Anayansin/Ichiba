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

// RQF40 / RQNF32: disputas de reembolso, ventas con retención preventiva y
// su dictamen administrativo.
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

// RQNF37 / RQNF38: adeudos de los vendedores (reembolsos por su culpa) y el
// registro de su liquidación total (pago por transferencia).
router.get("/adeudos", verificarToken, esAdmin, obtenerAdeudos);

router.post(
  "/adeudos/:id/liquidar",
  verificarToken,
  esAdmin,
  liquidarAdeudo,
);

// RQF14 / RQNF13.2 / RQNF14.1: informes globales mensuales, descarga en PDF y
// generación manual de un período (recuperación o pruebas controladas).
router.get("/informes", verificarToken, esAdmin, listarInformesGlobales);

router.post("/informes/generar", verificarToken, esAdmin, generarInformesAdmin);

router.get(
  "/informes/:periodo/pdf",
  verificarToken,
  esAdmin,
  descargarInformeGlobal,
);

export default router;
