import { Router } from "express";
import {
  fetchMensajesComoComprador,
  enviarMensajeComoComprador,
  fetchMensajesComoVendedor,
  enviarMensajeComoVendedor,
  fetchMisVentasComoComprador,
  fetchMisVentasComoVendedor,
} from "../controllers/mensajeController.js";
import { requiereCompradorId } from "../middleware/comprador.js";
import { verificarToken } from "../middleware/auth.js";

const router = Router();

// Comprador (anónimo, identificado por su compradorId)
router.get(
  "/comprador/mis-ventas",
  requiereCompradorId,
  fetchMisVentasComoComprador,
);
router.get(
  "/comprador/:ventaId",
  requiereCompradorId,
  fetchMensajesComoComprador,
);
router.post(
  "/comprador/:ventaId",
  requiereCompradorId,
  enviarMensajeComoComprador,
);

// Vendedor (con sesión JWT)
router.get("/vendedor/mis-ventas", verificarToken, fetchMisVentasComoVendedor);
router.get("/vendedor/:ventaId", verificarToken, fetchMensajesComoVendedor);
router.post("/vendedor/:ventaId", verificarToken, enviarMensajeComoVendedor);

export default router;
