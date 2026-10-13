import { Router } from "express";
import {
  crearOrden,
  capturarOrden,
  confirmarMercadoPago,
  webhookMercadoPago,
  calificar,
} from "../controllers/pagoController.js";
import {
  iniciarVinculacionPayPal,
  callbackVinculacionPayPal,
  estadoVinculacionPayPal,
} from "../controllers/paypalVinculacionController.js";
import { requiereCompradorId } from "../middleware/comprador.js";
import { verificarToken } from "../middleware/auth.js";

const router = Router();

router.post("/crear-orden", requiereCompradorId, crearOrden);
router.post("/capturar-orden/:orderId", requiereCompradorId, capturarOrden);

// RQF4: vinculación OAuth 2.0 de la cuenta del vendedor con PayPal.
// El navegador del vendedor sale hacia la pasarela oficial y regresa al
// callback sin cabeceras de autorización: ahí solo valida el `state`.
router.post("/paypal/vincular", verificarToken, iniciarVinculacionPayPal);
router.get("/paypal/vincular/callback", callbackVinculacionPayPal);
router.get("/paypal/vinculacion", verificarToken, estadoVinculacionPayPal);

// MercadoPago: el comprador vuelve del checkout y confirmamos el cobro.
router.post("/confirmar-mercadopago", requiereCompradorId, confirmarMercadoPago);

// Webhook (IPN): MercadoPago lo llama desde su infraestructura, por eso no
// lleva autenticación de comprador; se valida contra la API al procesarlo.
router.post("/webhook-mercadopago", webhookMercadoPago);

router.post("/:ventaId/calificar", calificar);

export default router;
