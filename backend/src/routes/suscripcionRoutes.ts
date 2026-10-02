import { Router } from "express";
import { suscribirseCategoria } from "../controllers/suscripcionController.js";

const router = Router();

router.post("/", suscribirseCategoria);

export default router;
