import { Router } from "express";
import {
  entrarEnFila,
  misFilas,
  salirDeFila,
} from "../controllers/colaController.js";
import { requiereCompradorId } from "../middleware/comprador.js";

const router = Router();

router.post("/entrar", requiereCompradorId, entrarEnFila);
router.get("/mias", requiereCompradorId, misFilas);
router.patch("/:id/salir", requiereCompradorId, salirDeFila);

export default router;
