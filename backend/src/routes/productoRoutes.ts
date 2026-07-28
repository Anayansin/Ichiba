import { Router } from "express";
import {
  getProductos,
  crearProducto,
} from "../controllers/productoController.js";

const router = Router();

router.get("/", getProductos);
router.post("/", crearProducto);

export default router;
