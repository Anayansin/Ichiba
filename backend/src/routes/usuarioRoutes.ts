import { Router } from "express";
import {
  registrarUsuario,
  iniciarSesion,
  obtenerPerfil,
  obtenerPerfilPublico,
} from "../controllers/usuarioController.js";
import { verificarToken } from "../middleware/auth.js";

const router = Router();

router.post("/registro", registrarUsuario);
router.post("/login", iniciarSesion);
router.get("/perfil", verificarToken, obtenerPerfil);
router.get("/:id/publico", obtenerPerfilPublico);

export default router;
