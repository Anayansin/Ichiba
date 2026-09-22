import { Router } from "express";
import { guardarSuscripcion } from "../controllers/notificacionController.js";
import { requiereCompradorId } from "../middleware/comprador.js";

const router = Router();

router.post("/suscribir", requiereCompradorId, guardarSuscripcion);

export default router;
