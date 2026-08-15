import api from "./api";

export type Producto = {
  _id: string;
  nombre: string;
  precio: number;
  imagenes: string[];
  categoria: string;
  descripcion: string;
  vendedor: string;
  vendedorId: string;
  datosDeEnvio: string;
  activo: boolean;
};

export type NuevoProducto = {
  nombre: string;
  precio: number;
  imagenes: string[];
  categoria: string;
  descripcion: string;
  datosDeEnvio: string;
};

export async function fetchProductos(): Promise<Producto[]> {
  const response = await api.get("/productos");
  return response.data;
}

export async function fetchProductoPorId(id: string): Promise<Producto> {
  const response = await api.get(`/productos/${id}`);
  return response.data;
}

export async function crearProducto(formData: FormData): Promise<Producto> {
  const response = await api.post("/productos", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
}

export async function fetchMisProductos(): Promise<Producto[]> {
  const response = await api.get("/productos/mios/lista");
  return response.data;
}

export async function actualizarProducto(
  id: string,
  formData: FormData,
): Promise<Producto> {
  const response = await api.put(`/productos/${id}`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
}

export async function cambiarEstadoProducto(id: string): Promise<Producto> {
  const response = await api.patch(`/productos/${id}/estado`);
  return response.data;
}

export async function eliminarProducto(id: string) {
  const response = await api.delete(`/productos/${id}`);
  return response.data;
}
