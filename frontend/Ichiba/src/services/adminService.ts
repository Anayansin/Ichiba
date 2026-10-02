import api from "./api";
import type { Mensaje } from "./mensajeService";

export type UsuarioAdmin = {
  id: string;
  nombreCompleto: string;
  correo: string;
  tipo: string;
  suspendido: boolean;
  fechaRegistro: string | null;
};

export type RespuestaUsuarios = {
  usuarios: UsuarioAdmin[];
  pagina: number;
  porPagina: number;
  total: number;
  totalPaginas: number;
};

export async function fetchUsuarios(
  pagina: number,
  porPagina: number,
): Promise<RespuestaUsuarios> {
  const response = await api.get("/admin/usuarios", {
    params: { pagina, porPagina },
  });
  return response.data;
}

export async function suspenderUsuario(id: string): Promise<UsuarioAdmin> {
  const response = await api.patch(`/admin/usuarios/${id}/suspender`);
  return response.data;
}

export async function reactivarUsuario(id: string): Promise<UsuarioAdmin> {
  const response = await api.patch(`/admin/usuarios/${id}/reactivar`);
  return response.data;
}

export type ReportePendiente = {
  id: number;
  categoria: string;
  categoriaNombre: string;
  elemento: string;
  tipoFalta: string;
  detalle: string | null;
  estado: string;
  sujetoTipo: string;
  reportadoPorTipo: string;
  vendedorNombre: string;
  fecha: string;
};

export type RespuestaResolucion = {
  message: string;
  estado?: string;
  faltasLeves?: number;
  faltaGraveRegistrada?: boolean;
};

export async function fetchReportesPendientes(): Promise<
  ReportePendiente[]
> {
  const response = await api.get("/admin/reportes/pendientes");
  return response.data;
}

export async function resolverReporte(
  id: number,
  resultado: "confirmado" | "rechazado",
): Promise<RespuestaResolucion> {
  const response = await api.patch(`/admin/reportes/${id}/resolver`, {
    resultado,
  });
  return response.data;
}

export type EntradaHistorial = {
  id: string;
  tipo: "fila" | "venta" | "reporte";
  fecha: string;
  estado: string;
  productoNombre: string;
  vendedorNombre: string;
  monto: number | null;
  detalle: string;
};

export async function fetchHistorialTransacciones(): Promise<
  EntradaHistorial[]
> {
  const response = await api.get("/admin/historial");
  return response.data;
}

export async function fetchMensajesDeVenta(
  ventaId: string,
): Promise<Mensaje[]> {
  const response = await api.get(`/admin/ventas/${ventaId}/mensajes`);
  return response.data;
}
