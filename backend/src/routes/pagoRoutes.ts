import { Router } from "express";
import {
  crearOrden,
  capturarOrden,
  calificar,
} from "../controllers/pagoController.js";
import { requiereCompradorId } from "../middleware/comprador.js";

const router = Router();

router.post("/crear-orden", requiereCompradorId, crearOrden);
router.post("/capturar-orden/:orderId", requiereCompradorId, capturarOrden);
router.post("/:ventaId/calificar", calificar);

export default router;
