import api from "./api";

export async function crearReporte(
  vendedorId: string,
  motivo: string,
  detalle: string,
) {
  const response = await api.post("/reportes", { vendedorId, motivo, detalle });
  return response.data;
}
