import { Router } from "express";
import {
  entrarEnFila,
  misFilas,
  salirDeFila,
  estadoDeMiFila,
  responderEsperaConfirmacion,
} from "../controllers/colaController.js";
import { requiereCompradorId } from "../middleware/comprador.js";

const router = Router();

router.post("/entrar", requiereCompradorId, entrarEnFila);
router.get("/mias", requiereCompradorId, misFilas);
router.get("/producto/:productoId/estado", requiereCompradorId, estadoDeMiFila);
router.patch("/:id/salir", requiereCompradorId, salirDeFila);
router.patch(
  "/:id/responder-confirmacion",
  requiereCompradorId,
  responderEsperaConfirmacion,
);

export default router;
