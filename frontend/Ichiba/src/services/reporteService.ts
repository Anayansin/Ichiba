import api from "./api";

export type DatosReporte = {
  elemento: string;
  categoria: string;
  detalle: string;
  ventaId?: string;
  productoId?: string;
  promocionalId?: string;
  vendedorId?: string;
  mensajeId?: string;
};

export type RespuestaReporte = {
  id: number;
  estado: "pendiente" | "confirmado" | "rechazado";
  message: string;
};

export type MiReporte = {
  id: number;
  elemento: string;
  categoriaNombre: string;
  detalle: string | null;
  estado: "pendiente" | "confirmado" | "rechazado";
  createdAt: string;
  updatedAt: string;
};

export async function fetchMisReportes(): Promise<MiReporte[]> {
  const response = await api.get("/reportes/mios");
  return response.data;
}

export async function crearReporte(
  datos: DatosReporte,
): Promise<RespuestaReporte> {
  const response = await api.post("/reportes", datos);
  return response.data;
}

export type DatosReporteComprador = {
  ventaId: string;
  categoria: string;
  detalle: string;
};

export async function crearReporteComprador(
  datos: DatosReporteComprador,
): Promise<RespuestaReporte> {
  const response = await api.post("/reportes/comprador", datos);
  return response.data;
}

export type ReporteAdmin = {
  id: number;
  tipoReportado: string;
  sujetoTipo: string;
  sujetoId: string;
  reportadoPorTipo: string;
  reportadoPorId: string;
  ventaId: string | null;
  elemento: string;
  categoria: string;
  categoriaNombre: string;
  tipoFalta: "leve" | "grave";
  detalle: string | null;
  estado: string;
  vendedorId: number;
  vendedorNombre: string;
  createdAt: string;
};

export type RespuestaConfirmacion = {
  message: string;
  faltasLeves: number;
  faltaGraveRegistrada: boolean;
};

export async function fetchReportes(estado?: string): Promise<ReporteAdmin[]> {
  const response = await api.get("/reportes", {
    params: estado ? { estado } : undefined,
  });
  return response.data;
}

export async function confirmarReporte(
  id: number,
): Promise<RespuestaConfirmacion> {
  const response = await api.patch(`/reportes/${id}/confirmar`);
  return response.data;
}
