import api from "./api";

export type Mensaje = {
  _id: string;
  ventaId: string;
  remitente: "comprador" | "vendedor";
  contenido: string;
  imagen?: string | null;
  createdAt: string;
};

export type VentaConProducto = {
  _id: string;
  productoId: { _id: string; nombre: string; imagenes: string[] };
  monto: number;
  createdAt: string;
  estado?:
    | "pendiente_comprobante"
    | "pendiente_confirmacion"
    | "en_entrega"
    | "completada"
    | "reembolsada"
    | "cancelada";
  codigoEntrega?: string | null;
  canceladoMotivo?: string | null;
  entregaLimite?: string | null;
  ventaIdPg?: number | null;
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

export async function enviarMensajeComprador(ventaId: string, contenido: string) {
  const response = await api.post(`/mensajes/comprador/${ventaId}`, { contenido });
  return response.data;
}

export async function fetchMensajesVendedor(
  ventaId: string,
): Promise<Mensaje[]> {
  const response = await api.get(`/mensajes/vendedor/${ventaId}`);
  return response.data;
}

export async function enviarMensajeVendedor(ventaId: string, contenido: string) {
  const response = await api.post(`/mensajes/vendedor/${ventaId}`, { contenido });
  return response.data;
}
