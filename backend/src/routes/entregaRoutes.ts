import { Router } from "express";
import {
  entregaComoComprador,
  entregaComoVendedor,
  registrarDireccion,
  registrarEnvio,
  registrarPropuesta,
  responderPropuesta,
} from "../controllers/entregaController.js";
import { requiereCompradorId } from "../middleware/comprador.js";
import { verificarToken } from "../middleware/auth.js";
import { requiereVendedorDeEntregas } from "../middleware/vendedor.js";

const router = Router();

router.get("/comprador/:ventaId", requiereCompradorId, entregaComoComprador);
router.post(
  "/comprador/:ventaId/propuesta",
  requiereCompradorId,
  responderPropuesta,
);
router.post(
  "/comprador/:ventaId/direccion",
  requiereCompradorId,
  registrarDireccion,
);

router.get(
  "/vendedor/:ventaId",
  verificarToken,
  requiereVendedorDeEntregas,
  entregaComoVendedor,
);
router.post(
  "/vendedor/:ventaId/propuesta",
  verificarToken,
  requiereVendedorDeEntregas,
  registrarPropuesta,
);
router.post(
  "/vendedor/:ventaId/envio",
  verificarToken,
  requiereVendedorDeEntregas,
  registrarEnvio,
);

export default router;
