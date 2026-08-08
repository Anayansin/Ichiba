import { Router } from "express";
import {
  entrarEnFila,
  misFilas,
  salirDeFila,
  estadoDeMiFila,
} from "../controllers/colaController.js";
import { requiereCompradorId } from "../middleware/comprador.js";

const router = Router();

router.post("/entrar", requiereCompradorId, entrarEnFila);
router.get("/mias", requiereCompradorId, misFilas);
router.get("/producto/:productoId/estado", requiereCompradorId, estadoDeMiFila);
router.patch("/:id/salir", requiereCompradorId, salirDeFila);

export default router;
