import { Router } from "express";
import {
  getProductos,
  getProductoPorId,
  getMisProductos,
  crearProducto,
} from "../controllers/productoController.js";
import { verificarToken } from "../middleware/auth.js";
import { requiereVerificado } from "../middleware/verificado.js";
import { upload } from "../middleware/upload.js";

const router = Router();

router.get("/", getProductos);
router.get("/mios/lista", verificarToken, getMisProductos);
router.get("/:id", getProductoPorId);
router.post(
  "/",
  verificarToken,
  requiereVerificado,
  upload.array("imagenes", 6),
  crearProducto,
);

export default router;
