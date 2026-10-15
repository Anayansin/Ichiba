import { Router } from "express";
import {
  entrarEnFila,
  misFilas,
  salirDeFila,
  estadoDeMiFila,
  responderEsperaConfirmacion,
} from "../controllers/colaController.js";
import { requiereCompradorId } from "../middleware/comprador.js";
import { requiereCompradorSinSancion } from "../middleware/sancion.js";
import { rechazarAdminEnCompra } from "../middleware/vendedor.js";

const router = Router();

router.post(
  "/entrar",
  rechazarAdminEnCompra,
  requiereCompradorId,
  requiereCompradorSinSancion,
  entrarEnFila,
);
router.get("/mias", requiereCompradorId, misFilas);
router.get("/producto/:productoId/estado", requiereCompradorId, estadoDeMiFila);
router.patch("/:id/salir", requiereCompradorId, salirDeFila);
router.patch(
  "/:id/responder-confirmacion",
  requiereCompradorId,
  responderEsperaConfirmacion,
);

export default router;
