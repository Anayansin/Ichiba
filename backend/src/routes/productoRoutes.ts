import { Router } from "express";
import {
  getProductos,
  getProductoPorId,
  getMisProductos,
  crearProducto,
  actualizarProducto,
  cambiarEstadoProducto,
  eliminarProducto,
  getCategoriaPopular,
} from "../controllers/productoController.js";
import { verificarToken } from "../middleware/auth.js";
import { requiereVendedor } from "../middleware/vendedor.js";
import { requiereVerificado } from "../middleware/verificado.js";
import { requiereUsuarioSinSancion } from "../middleware/sancion.js";
import { subirFotosProducto } from "../middleware/upload.js";

const router = Router();

router.get("/", getProductos);
router.get("/mios/lista", verificarToken, getMisProductos);
router.get("/estadisticas/categoria-popular", getCategoriaPopular);
router.get("/:id", getProductoPorId);
router.post(
  "/",
  verificarToken,
  requiereVendedor,
  requiereVerificado,
  requiereUsuarioSinSancion,
  subirFotosProducto("imagenes", 6),
  crearProducto,
);
router.put(
  "/:id",
  verificarToken,
  requiereVendedor,
  requiereVerificado,
  requiereUsuarioSinSancion,
  subirFotosProducto("imagenes", 6),
  actualizarProducto,
);
router.patch(
  "/:id/estado",
  verificarToken,
  requiereVendedor,
  requiereVerificado,
  cambiarEstadoProducto,
);
router.delete(
  "/:id",
  verificarToken,
  requiereVendedor,
  requiereVerificado,
  eliminarProducto,
);

export default router;
