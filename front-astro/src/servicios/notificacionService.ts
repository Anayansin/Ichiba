import api from "./api";

export async function guardarSuscripcion(
  correo: string,
  categorias: string[],
): Promise<{ message: string }> {
  const response = await api.post("/notificaciones/suscribir", {
    correo,
    categorias,
  });
  return response.data;
}
