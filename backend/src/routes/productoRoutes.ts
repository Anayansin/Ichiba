import { Router } from "express";
import {
  getProductos,
  getProductoPorId,
  crearProducto,
} from "../controllers/productoController.js";

const router = Router();

router.get("/", getProductos);
router.get("/:id", getProductoPorId);
router.post("/", crearProducto);

export default router;
