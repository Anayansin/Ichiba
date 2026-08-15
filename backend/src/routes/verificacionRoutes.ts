import { Router } from "express";
import {
  enviarCodigoCorreo,
  verificarCodigoCorreo,
} from "../controllers/verificacionController.js";
import { verificarToken } from "../middleware/auth.js";

const router = Router();

router.post("/correo/enviar", verificarToken, enviarCodigoCorreo);
router.post("/correo/verificar", verificarToken, verificarCodigoCorreo);

export default router;
