import { Router } from "express";
import { crearOrden, capturarOrden } from "../controllers/pagoController.js";
import { requiereCompradorId } from "../middleware/comprador.js";

const router = Router();

router.post("/crear-orden", requiereCompradorId, crearOrden);
router.post("/capturar-orden/:orderId", requiereCompradorId, capturarOrden);

export default router;
