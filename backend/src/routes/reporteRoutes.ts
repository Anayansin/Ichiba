import { Router } from "express";
import {
  crearReporte,
  crearReporteComprador,
  misReportes,
  listarReportes,
  confirmarReporte,
} from "../controllers/reporteController.js";
import { verificarToken } from "../middleware/auth.js";
import { requiereAdmin } from "../middleware/admin.js";

const router = Router();

router.post("/", crearReporte);

router.post("/comprador", verificarToken, crearReporteComprador);

router.get("/mios", misReportes);

router.get("/", verificarToken, requiereAdmin, listarReportes);

router.patch(
  "/:id/confirmar",
  verificarToken,
  requiereAdmin,
  confirmarReporte,
);

export default router;
