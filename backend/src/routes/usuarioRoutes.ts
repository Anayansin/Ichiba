import { Router } from "express";
import {
  registrarUsuario,
  iniciarSesion,
  obtenerPerfil,
  obtenerPerfilPublico,
  confirmarHorario,
} from "../controllers/usuarioController.js";
import { verificarToken } from "../middleware/auth.js";
import { uploadIne } from "../middleware/uploadIne.js";

const router = Router();

router.post(
  "/registro",
  uploadIne.fields([
    { name: "ineFrente", maxCount: 1 },
    { name: "ineReverso", maxCount: 1 },
  ]),
  registrarUsuario,
);
router.post("/login", iniciarSesion);
router.get("/perfil", verificarToken, obtenerPerfil);
router.get("/:id/publico", obtenerPerfilPublico);
router.put("/confirmar-horario", verificarToken, confirmarHorario);

export default router;
