import { Router } from "express";
import {
  registrarUsuario,
  iniciarSesion,
  obtenerPerfil,
  obtenerDatosSensibles,
  obtenerPerfilPublico,
  confirmarHorario,
  actualizarPreferencias,
  solicitarRecuperacion,
  verificarCodigoRecuperacion,
  restablecerPassword,
  solicitarRevisionDeRegistro,
} from "../controllers/usuarioController.js";
import { verificarToken } from "../middleware/auth.js";
import {
  rechazarCuentaCancelada,
  requiereVendedor,
} from "../middleware/vendedor.js";
import { subirImagenesIne } from "../middleware/uploadIne.js";

const router = Router();

router.post(
  "/registro",
  subirImagenesIne,
  registrarUsuario,
);
router.post("/login", iniciarSesion);
router.post("/registro/solicitar-revision", solicitarRevisionDeRegistro);
router.post("/recuperar/solicitar", solicitarRecuperacion);
router.post("/recuperar/verificar", verificarCodigoRecuperacion);
router.post("/recuperar/restablecer", restablecerPassword);
router.get("/perfil", verificarToken, obtenerPerfil);
router.post("/perfil/datos-sensibles", verificarToken, obtenerDatosSensibles);
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
