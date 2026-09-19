import { Router } from "express";
import { crearReporte } from "../controllers/reporteController.js";
import { requiereCompradorId } from "../middleware/comprador.js";

const router = Router();
router.post("/", requiereCompradorId, crearReporte);
export default router;
