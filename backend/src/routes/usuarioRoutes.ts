import { Router } from "express";
import {
  registrarUsuario,
  iniciarSesion,
  obtenerPerfil,
  obtenerPerfilPublico,
  confirmarHorario,
  actualizarPreferencias,
  solicitarRecuperacion,
  verificarCodigoRecuperacion,
  restablecerPassword,
} from "../controllers/usuarioController.js";
import { verificarToken } from "../middleware/auth.js";
import {
  rechazarCuentaCancelada,
  requiereVendedor,
} from "../middleware/vendedor.js";
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
router.post("/recuperar/solicitar", solicitarRecuperacion);
router.post("/recuperar/verificar", verificarCodigoRecuperacion);
router.post("/recuperar/restablecer", restablecerPassword);
router.get("/perfil", verificarToken, obtenerPerfil);
// RQF12: las preferencias de notificación no forman parte de completar una
// entrega, así que una cuenta cancelada no puede modificarlas.
router.put(
  "/preferencias",
  verificarToken,
  rechazarCuentaCancelada,
  actualizarPreferencias,
);
router.get("/:id/publico", obtenerPerfilPublico);
router.put(
  "/confirmar-horario",
  verificarToken,
  requiereVendedor,
  confirmarHorario,
);

export default router;
