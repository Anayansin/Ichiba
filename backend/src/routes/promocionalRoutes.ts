import { isValidObjectId } from "mongoose";
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
import {
  crearComentario,
  obtenerComentarios,
} from "../controllers/comentarioController.js";
import { verificarToken } from "../middleware/auth.js";
import { requiereVendedor } from "../middleware/vendedor.js";
import { requiereVerificado } from "../middleware/verificado.js";
import { requiereUsuarioSinSancion } from "../middleware/sancion.js";
import { requiereCompradorId } from "../middleware/comprador.js";
import { subirFotosProducto } from "../middleware/upload.js";

const router = Router();

router.param("id", (_req, res, next, id) => {
  if (isValidObjectId(id)) return next();
  res.status(404).json({ message: "Promocional no encontrado" });
});

router.get("/", obtenerPromocionales);
router.get("/mios/lista", verificarToken, obtenerMisPromocionales);
router.get("/:id", obtenerPromocionalPorId);
router.get("/:id/comentarios", obtenerComentarios);
router.post(
  "/:id/comentarios",
  requiereCompradorId,
  crearComentario,
);
router.post(
  "/",
  verificarToken,
  requiereVendedor,
  requiereVerificado,
  requiereUsuarioSinSancion,
  subirFotosProducto("imagenes", 6),
  crearPromocional,
);
router.patch(
  "/:id/estado",
  verificarToken,
  requiereVendedor,
  cambiarEstadoPromocional,
);
router.put(
  "/:id",
  verificarToken,
  requiereVendedor,
  requiereUsuarioSinSancion,
  subirFotosProducto("imagenes", 6),
  actualizarPromocional,
);
router.delete("/:id", verificarToken, requiereVendedor, eliminarPromocional);

export default router;
