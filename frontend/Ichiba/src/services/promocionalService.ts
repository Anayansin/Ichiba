import api from "./api";

export type Promocional = {
  _id: string;
  nombre: string;
  precio: number;
  categoria: string;
  descripcion: string;
  imagenes: string[];
  vendedor: string;
  vendedorId: string;
  activo: boolean;
  createdAt: string;
};

export async function fetchPromocionales(
  tipo?: string | null,
): Promise<Promocional[]> {
  const response = await api.get("/promocionales", {
    params: tipo ? { categoria: tipo } : undefined,
  });
  return response.data;
}

export async function fetchPromocionalPorId(id: string): Promise<Promocional> {
  const response = await api.get(`/promocionales/${id}`);
  return response.data;
}

export async function crearPromocional(
  formData: FormData,
): Promise<Promocional> {
  const response = await api.post("/promocionales", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
}

export async function fetchMisPromocionales(): Promise<Promocional[]> {
  const response = await api.get("/promocionales/mios/lista");
  return response.data;
}

export async function cambiarEstadoPromocional(
  id: string,
): Promise<Promocional> {
  const response = await api.patch(`/promocionales/${id}/estado`);
  return response.data;
}

export async function eliminarPromocional(id: string) {
  const response = await api.delete(`/promocionales/${id}`);
  return response.data;
}
