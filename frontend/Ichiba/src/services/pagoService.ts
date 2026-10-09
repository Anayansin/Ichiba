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
