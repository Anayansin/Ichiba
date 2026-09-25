import { Router } from "express";
import {
  getPromocionales,
  getPromocionalPorId,
  getMisPromocionales,
  crearPromocional,
  cambiarEstadoPromocional,
  eliminarPromocional,
} from "../controllers/promocionalController.js";
import { verificarToken } from "../middleware/auth.js";
import { requiereVerificado } from "../middleware/verificado.js";
import { requiereUsuarioSinSancion } from "../middleware/sancion.js";
import { upload } from "../middleware/upload.js";

const router = Router();

// Los promocionales se anuncian, no se compran: no existe fila ni pago
router.get("/", getPromocionales);
router.get("/mios/lista", verificarToken, getMisPromocionales);
router.get("/:id", getPromocionalPorId);
router.post(
  "/",
  verificarToken,
  requiereVerificado,
  requiereUsuarioSinSancion,
  upload.array("imagenes", 6),
  crearPromocional,
);
router.patch("/:id/estado", verificarToken, cambiarEstadoPromocional);
router.delete("/:id", verificarToken, eliminarPromocional);

export default router;
