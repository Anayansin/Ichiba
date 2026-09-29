import { Router } from "express";
import {
  obtenerPromocionales,
  obtenerPromocionalPorId,
  obtenerMisPromocionales,
  crearPromocional,
  actualizarPromocional,
  cambiarEstadoPromocional,
  eliminarPromocional,
} from "../controllers/promocionalController.js";
import { verificarToken } from "../middleware/auth.js";
import { requiereVerificado } from "../middleware/verificado.js";
import { requiereUsuarioSinSancion } from "../middleware/sancion.js";
import { upload } from "../middleware/upload.js";

const router = Router();

router.get("/", obtenerPromocionales);
router.get("/mios/lista", verificarToken, obtenerMisPromocionales);
router.get("/:id", obtenerPromocionalPorId);
router.post(
  "/",
  verificarToken,
  requiereVerificado,
  requiereUsuarioSinSancion,
  upload.array("imagenes", 6),
  crearPromocional,
);
router.patch("/:id/estado", verificarToken, cambiarEstadoPromocional);
router.put(
  "/:id",
  verificarToken,
  requiereUsuarioSinSancion,
  upload.array("imagenes", 6),
  actualizarPromocional,
);
router.delete("/:id", verificarToken, eliminarPromocional);

export default router;
