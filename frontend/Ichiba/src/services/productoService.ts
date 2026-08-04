import api from "./api";

export type DatosProductos = {
  nombre: string;
  precio: number;
  imagenes: string[];
  descripcion: string;
  categoria: string;
  datosDeEnvio: string;
};

export async function registrarProducto(datos: DatosProductos) {
  const response = await api.post("/productos/registro", datos);
  return response.data;
}
