import { Router } from "express";
import {
  enviarCodigoTelefono,
  enviarCodigoCorreo,
  verificarCodigoTelefono,
  verificarCodigoCorreo,
} from "../controllers/verificacionController.js";
import { verificarToken } from "../middleware/auth.js";

const router = Router();

router.post("/telefono/enviar", verificarToken, enviarCodigoTelefono);
router.post("/telefono/verificar", verificarToken, verificarCodigoTelefono);
router.post("/correo/enviar", verificarToken, enviarCodigoCorreo);
router.post("/correo/verificar", verificarToken, verificarCodigoCorreo);

export default router;
