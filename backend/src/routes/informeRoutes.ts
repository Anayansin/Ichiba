import { Router } from "express";
import {
  listarInformesDelVendedor,
  descargarInformeDelVendedor,
} from "../controllers/informeController.js";
import { verificarToken } from "../middleware/auth.js";
import { requiereVendedor } from "../middleware/vendedor.js";

/**
 * RQF13 / RQNF13.3: historial de informes mensuales de ventas del vendedor y
 * descarga en PDF. Las cuentas canceladas no entran aquí (RQF12): solo
 * conservan acceso a sus entregas con pago confirmado.
 */
const router = Router();

router.get("/", verificarToken, requiereVendedor, listarInformesDelVendedor);

router.get(
  "/:periodo/pdf",
  verificarToken,
  requiereVendedor,
  descargarInformeDelVendedor,
);

export default router;
