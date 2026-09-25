import api from "./api";

export type Mensaje = {
  _id: string;
  ventaId: string;
  remitente: "comprador" | "vendedor";
  contenido: string;
  /** Ruta relativa de la imagen adjunta (ej. /uploads/archivo.png) */
  imagen?: string | null;
  createdAt: string;
};

export type VentaConProducto = {
  _id: string;
  productoId: { _id: string; nombre: string; imagenes: string[] };
  monto: number;
  createdAt: string;
};

export async function fetchMisVentasComprador(): Promise<VentaConProducto[]> {
  const response = await api.get("/mensajes/comprador/mis-ventas");
  return response.data;
}

export async function fetchMisVentasVendedor(): Promise<VentaConProducto[]> {
  const response = await api.get("/mensajes/vendedor/mis-ventas");
  return response.data;
}

export async function fetchMensajesComprador(
  ventaId: string,
): Promise<Mensaje[]> {
  const response = await api.get(`/mensajes/comprador/${ventaId}`);
  return response.data;
}

function crearFormData(contenido: string, imagen?: File | null) {
  const formData = new FormData();
  formData.append("contenido", contenido);
  if (imagen) formData.append("imagen", imagen);
  return formData;
}

export async function enviarMensajeComprador(
  ventaId: string,
  contenido: string,
  imagen?: File | null,
) {
  const response = await api.post(
    `/mensajes/comprador/${ventaId}`,
    crearFormData(contenido, imagen),
  );
  return response.data;
}

export async function fetchMensajesVendedor(
  ventaId: string,
): Promise<Mensaje[]> {
  const response = await api.get(`/mensajes/vendedor/${ventaId}`);
  return response.data;
}

export async function enviarMensajeVendedor(
  ventaId: string,
  contenido: string,
  imagen?: File | null,
) {
  const response = await api.post(
    `/mensajes/vendedor/${ventaId}`,
    crearFormData(contenido, imagen),
  );
  return response.data;
}
