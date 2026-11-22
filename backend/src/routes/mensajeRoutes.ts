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
import {
  requiereCompradorSinSancion,
  requiereUsuarioSinSancionDeEntregas,
} from "../middleware/sancion.js";

const router = Router();

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
  requiereCompradorSinSancion,
  enviarMensajeComoComprador,
);

router.get("/vendedor/mis-ventas", verificarToken, fetchMisVentasComoVendedor);
router.get("/vendedor/:ventaId", verificarToken, fetchMensajesComoVendedor);
router.post(
  "/vendedor/:ventaId",
  verificarToken,
  requiereUsuarioSinSancionDeEntregas,
  enviarMensajeComoVendedor,
);

export default router;
