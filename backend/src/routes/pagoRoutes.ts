import { Router } from "express";
import {
  crearOrden,
  capturarOrden,
  confirmarMercadoPago,
  webhookMercadoPago,
  calificar,
} from "../controllers/pagoController.js";
import { requiereCompradorId } from "../middleware/comprador.js";

const router = Router();

router.post("/crear-orden", requiereCompradorId, crearOrden);
router.post("/capturar-orden/:orderId", requiereCompradorId, capturarOrden);

// MercadoPago: el comprador vuelve del checkout y confirmamos el cobro.
router.post("/confirmar-mercadopago", requiereCompradorId, confirmarMercadoPago);

// Webhook (IPN): MercadoPago lo llama desde su infraestructura, por eso no
// lleva autenticación de comprador; se valida contra la API al procesarlo.
router.post("/webhook-mercadopago", webhookMercadoPago);

router.post("/:ventaId/calificar", calificar);

export default router;
