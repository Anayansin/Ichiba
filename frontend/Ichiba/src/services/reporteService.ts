import api from "./api";

export type DatosReporte = {
  /** Compra que relaciona al reportero con la persona reportada. */
  ventaId: string;
  elemento: string;
  categoria: string;
  detalle?: string;
  mensajeId?: string;
};

export type RespuestaReporte = {
  message: string;
  sujetoSancionado?: boolean;
};

/**
 * Envía un reporte. Funciona tanto para el comprador (x-comprador-id)
 * como para el vendedor (JWT); el backend resuelve a quién se reporta
 * a partir de la venta.
 */
export async function crearReporte(
  datos: DatosReporte,
): Promise<RespuestaReporte> {
  const response = await api.post("/reportes", datos);
  return response.data;
}

export type DatosReporteComprador = {
  ventaId: string;
  elemento: string;
  motivo: string;
  detalle?: string;
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
