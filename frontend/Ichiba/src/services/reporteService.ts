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
