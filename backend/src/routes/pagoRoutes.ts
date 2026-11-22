import { Router } from "express";
import {
  crearOrden,
  capturarOrden,
  webhookPaypal,
  registrarComprobante,
  confirmarComprobante,
  rechazarComprobante,
  registrarEntrega,
  detalleDeVenta,
  imagenDeComprobante,
  ventasDelVendedor,
  misComprasDelComprador,
  calificar,
  abrirDisputa,
  responderDisputaDeVenta,
  misDisputasDelComprador,
  disputasDelVendedor,
  imagenEvidenciaDisputa,
} from "../controllers/pagoController.js";
import {
  iniciarVinculacionPayPal,
  callbackVinculacionPayPal,
  estadoVinculacionPayPal,
} from "../controllers/paypalVinculacionController.js";
import { requiereCompradorId } from "../middleware/comprador.js";
import { verificarToken } from "../middleware/auth.js";
import {
  subirComprobante,
  subirEvidenciasDisputa,
} from "../middleware/upload.js";
import {
  rechazarAdminEnCompra,
  requiereVendedor,
  requiereVendedorDeEntregas,
} from "../middleware/vendedor.js";

const router = Router();

router.post("/webhook-paypal", webhookPaypal);

router.post("/crear-orden", rechazarAdminEnCompra, requiereCompradorId, crearOrden);
router.post(
  "/capturar-orden/:orderId",
  rechazarAdminEnCompra,
  requiereCompradorId,
  capturarOrden,
);

router.post(
  "/paypal/vincular",
  verificarToken,
  requiereVendedor,
  iniciarVinculacionPayPal,
);
router.get("/paypal/vincular/callback", callbackVinculacionPayPal);
router.get("/paypal/vinculacion", verificarToken, estadoVinculacionPayPal);

router.post(
  "/:ventaId/comprobante",
  rechazarAdminEnCompra,
  requiereCompradorId,
  subirComprobante("comprobante"),
  registrarComprobante,
);

router.get("/comprobante/:ventaId/imagen", imagenDeComprobante);

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

router.post(
  "/:ventaId/confirmar-entrega",
  verificarToken,
  requiereVendedorDeEntregas,
  registrarEntrega,
);

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

router.post(
  "/:ventaId/disputa",
  rechazarAdminEnCompra,
  requiereCompradorId,
  subirEvidenciasDisputa("evidencias"),
  abrirDisputa,
);
router.get(
  "/disputas/mis-disputas",
  rechazarAdminEnCompra,
  requiereCompradorId,
  misDisputasDelComprador,
);
router.get(
  "/vendedor/disputas",
  verificarToken,
  requiereVendedorDeEntregas,
  disputasDelVendedor,
);
router.post(
  "/disputas/:disputaId/responder",
  verificarToken,
  requiereVendedorDeEntregas,
  subirEvidenciasDisputa("evidencias"),
  responderDisputaDeVenta,
);

router.get(
  "/disputas/:disputaId/evidencia/:lado/:indice",
  imagenEvidenciaDisputa,
);

router.get("/:ventaId/detalle", detalleDeVenta);

router.post("/:ventaId/calificar", calificar);

export default router;
