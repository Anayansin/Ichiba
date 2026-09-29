import { Router } from "express";
import {
  crearReporte,
  crearReporteComprador,
  listarReportes,
  confirmarReporte,
} from "../controllers/reporteController.js";
import { verificarToken } from "../middleware/auth.js";
import { requiereAdmin } from "../middleware/admin.js";

const router = Router();

// El identidad del reportero (vendedor con JWT o comprador con
// x-comprador-id) se resuelve dentro del controlador.
router.post("/", crearReporte);

router.post("/comprador", verificarToken, crearReporteComprador);

router.get("/", verificarToken, requiereAdmin, listarReportes);

router.patch(
  "/:id/confirmar",
  verificarToken,
  requiereAdmin,
  confirmarReporte,
);

export default router;
