import { Router } from "express";
import {
  crearOrden,
  capturarOrden,
  confirmarMercadoPago,
  webhookMercadoPago,
  registrarComprobante,
  confirmarComprobante,
  rechazarComprobante,
  registrarEntrega,
  detalleDeVenta,
  imagenDeComprobante,
  ventasDelVendedor,
  misComprasDelComprador,
  calificar,
} from "../controllers/pagoController.js";
import {
  iniciarVinculacionPayPal,
  callbackVinculacionPayPal,
  estadoVinculacionPayPal,
} from "../controllers/paypalVinculacionController.js";
import { requiereCompradorId } from "../middleware/comprador.js";
import { verificarToken } from "../middleware/auth.js";
import { subirComprobante } from "../middleware/upload.js";
import {
  rechazarAdminEnCompra,
  requiereVendedor,
  requiereVendedorDeEntregas,
} from "../middleware/vendedor.js";

const router = Router();

router.post("/crear-orden", rechazarAdminEnCompra, requiereCompradorId, crearOrden);
router.post(
  "/capturar-orden/:orderId",
  rechazarAdminEnCompra,
  requiereCompradorId,
  capturarOrden,
);

// RQF4: vinculación OAuth 2.0 de la cuenta del vendedor con PayPal.
// El navegador del vendedor sale hacia la pasarela oficial y regresa al
// callback sin cabeceras de autorización: ahí solo valida el `state`.
router.post(
  "/paypal/vincular",
  verificarToken,
  requiereVendedor,
  iniciarVinculacionPayPal,
);
router.get("/paypal/vincular/callback", callbackVinculacionPayPal);
router.get("/paypal/vinculacion", verificarToken, estadoVinculacionPayPal);

// MercadoPago: el comprador vuelve del checkout y confirmamos el cobro.
router.post(
  "/confirmar-mercadopago",
  rechazarAdminEnCompra,
  requiereCompradorId,
  confirmarMercadoPago,
);

// Webhook (IPN): MercadoPago lo llama desde su infraestructura, por eso no
// lleva autenticación de comprador; se valida contra la API al procesarlo.
router.post("/webhook-mercadopago", webhookMercadoPago);

// RQF22: el comprador registra su comprobante (palabra clave + referencia +
// fotografía moderada). La imagen viaja como archivo (`comprobante`).
router.post(
  "/:ventaId/comprobante",
  rechazarAdminEnCompra,
  requiereCompradorId,
  subirComprobante("comprobante"),
  registrarComprobante,
);

// La imagen del comprobante solo la ven las partes de la venta (el archivo
// no se sirve estático).
router.get("/comprobante/:ventaId/imagen", imagenDeComprobante);

// RQF31: el vendedor confirma o rechaza el comprobante recibido.
// RQF12: estas acciones siguen disponibles para el vendedor con cuenta
// cancelada, porque son parte de completar una entrega con pago confirmado.
router.post(
  "/:ventaId/confirmar-comprobante",
  verificarToken,
  requiereVendedorDeEntregas,
  confirmarComprobante,
);
router.post(
  "/:ventaId/rechazar-comprobante",
  verificarToken,
  requiereVendedorDeEntregas,
  rechazarComprobante,
);

// RQF33 / RQNF27: el vendedor registra el código de entrega del comprador y
// se liberan los fondos del escrow.
router.post(
  "/:ventaId/confirmar-entrega",
  verificarToken,
  requiereVendedorDeEntregas,
  registrarEntrega,
);

// Seguimiento del flujo del escrow para cada parte.
router.get(
  "/vendedor/ventas",
  verificarToken,
  requiereVendedorDeEntregas,
  ventasDelVendedor,
);
router.get(
  "/mis-compras",
  rechazarAdminEnCompra,
  requiereCompradorId,
  misComprasDelComprador,
);

// Detalle de una compra (comprador o vendedor).
router.get("/:ventaId/detalle", detalleDeVenta);

router.post("/:ventaId/calificar", calificar);

export default router;
