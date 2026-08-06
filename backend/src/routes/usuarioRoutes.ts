import { Router } from "express";
import {
  registrarUsuario,
  iniciarSesion,
  obtenerPerfil,
} from "../controllers/usuarioController.js";
import { verificarToken } from "../middleware/auth.js";

const router = Router();

router.post("/registro", registrarUsuario);
router.post("/login", iniciarSesion);
router.get("/perfil", verificarToken, obtenerPerfil);

export default router;
