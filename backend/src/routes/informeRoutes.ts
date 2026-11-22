import { Router } from "express";
import {
  listarInformesDelVendedor,
  descargarInformeDelVendedor,
} from "../controllers/informeController.js";
import { verificarToken } from "../middleware/auth.js";
import { requiereVendedor } from "../middleware/vendedor.js";

const router = Router();

router.get("/", verificarToken, requiereVendedor, listarInformesDelVendedor);

router.get(
  "/:periodo/pdf",
  verificarToken,
  requiereVendedor,
  descargarInformeDelVendedor,
);

export default router;
