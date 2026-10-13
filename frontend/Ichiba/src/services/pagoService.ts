import api from "./api";

export async function crearOrdenPago(productoId: string) {
  const response = await api.post("/pagos/crear-orden", { productoId });
  return response.data;
}

export async function capturarOrdenPago(orderId: string) {
  const response = await api.post(`/pagos/capturar-orden/${orderId}`);
  return response.data;
}

/** Confirmación de vuelta del checkout de MercadoPago. */
export async function confirmarPagoMercadoPago(paymentId: string) {
  const response = await api.post("/pagos/confirmar-mercadopago", {
    paymentId,
  });
  return response.data;
}

/**
 * RQF4: pide al backend la URL de la pasarela oficial de PayPal para que el
 * vendedor autorice su cuenta con OAuth 2.0. El navegador sale hacia ahí.
 */
export async function iniciarVinculacionPayPal() {
  const response = await api.post("/pagos/paypal/vincular");
  return response.data as { url: string };
}

/** Estado de la vinculación (nunca devuelve el token, solo el Merchant ID). */
export async function estadoVinculacionPayPal() {
  const response = await api.get("/pagos/paypal/vinculacion");
  return response.data as {
    vinculado: boolean;
    correoPayPal: string | null;
    merchantId: string | null;
    vinculadoEn: string | null;
    metodoPago: string;
  };
}
