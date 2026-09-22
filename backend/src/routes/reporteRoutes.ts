import { Router } from "express";
import { crearReporte } from "../controllers/reporteController.js";

const router = Router();

// El identidad del reportero (vendedor con JWT o comprador con
// x-comprador-id) se resuelve dentro del controlador.
router.post("/", crearReporte);

export default router;
