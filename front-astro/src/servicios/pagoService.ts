import api from "./api";

export async function crearOrdenPago(productoId: string) {
  const response = await api.post("/pagos/crear-orden", { productoId });
  return response.data;
}

export async function capturarOrdenPago(orderId: string) {
  const response = await api.post(`/pagos/capturar-orden/${orderId}`);
  return response.data;
}
