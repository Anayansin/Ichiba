import api from "./api";
import type { Mensaje } from "./mensajeService";

export type UsuarioAdmin = {
  id: string;
  nombreCompleto: string;
  correo: string;
  tipo: string;
  suspendido: boolean;
  puntosReputacion: number;
  estadoCuenta: string;
  fechaRegistro: string | null;
  motivoSuspension?: string | null;
  saldoPendiente?: number;
  sancionHasta?: string | null;
  sancionPermanente?: boolean;
  revisionAdministrativa?: boolean;
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
  busqueda?: string,
): Promise<RespuestaUsuarios> {
  const response = await api.get("/admin/usuarios", {
    params: { pagina, porPagina, ...(busqueda ? { busqueda } : {}) },
  });
  return response.data;
}

export async function suspenderUsuario(
  id: string,
  motivo: string,
): Promise<UsuarioAdmin> {
  const response = await api.patch(`/admin/usuarios/${id}/suspender`, {
    motivo,
  });
  return response.data;
}

export async function reactivarUsuario(id: string): Promise<UsuarioAdmin> {
  const response = await api.patch(`/admin/usuarios/${id}/reactivar`);
  return response.data;
}

export async function agregarUsuarioAListaNegra(
  id: string,
  motivo: string,
): Promise<{ message: string; entrada: EntradaListaNegra }> {
  const response = await api.post(`/admin/usuarios/${id}/lista-negra`, {
    motivo,
  });
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
  puntos: number;
  puntosReputacion: number;
  puntosCancelacion: number;
  estadoCuenta: string;
  fecha: string;
};

export type RespuestaResolucion = {
  message: string;
  estado?: string;
  faltasLeves?: number;
  faltaGraveRegistrada?: boolean;
  puntos?: number;
  puntosReputacion?: number;
  cuentaCancelada?: boolean;
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

export type EntradaListaNegra = {
  id: string;
  rfc: string | null;
  curp: string | null;
  ineCodigoReverso: string | null;
  correo: string | null;
  nombreCompleto: string;
  motivo: string;
  origen: string;
  fecha: string | null;
};

export type RespuestaListaNegra = {
  entradas: EntradaListaNegra[];
  pagina: number;
  porPagina: number;
  total: number;
  totalPaginas: number;
};

export async function fetchListaNegra(
  pagina: number,
  porPagina: number,
): Promise<RespuestaListaNegra> {
  const response = await api.get("/admin/lista-negra", {
    params: { pagina, porPagina },
  });
  return response.data;
}

export type NuevaEntradaListaNegra = {
  rfc?: string;
  curp?: string;
  ineCodigoReverso?: string;
  correo?: string;
  nombreCompleto?: string;
  motivo: string;
};

export async function agregarEntradaListaNegra(
  datos: NuevaEntradaListaNegra,
): Promise<EntradaListaNegra> {
  const response = await api.post("/admin/lista-negra", datos);
  return response.data;
}

export async function quitarEntradaListaNegra(
  id: string,
): Promise<{ message: string }> {
  const response = await api.delete(`/admin/lista-negra/${id}`);
  return response.data;
}

export type SolicitudRegistroAdmin = {
  id: string;
  nombreCompleto: string;
  correo: string;
  telefono: string;
  rfc: string;
  motivoBloqueo: string;
  camposCoincidentes: string[];
  mensaje: string;
  estado: string;
  respuesta: string;
  revisadaPor: string;
  revisadaEn: string | null;
  fecha: string | null;
};

export type RespuestaSolicitudesRegistro = {
  solicitudes: SolicitudRegistroAdmin[];
  pagina: number;
  porPagina: number;
  total: number;
  totalPaginas: number;
};

export async function fetchSolicitudesRegistro(
  pagina: number,
  porPagina: number,
  estado?: string,
): Promise<RespuestaSolicitudesRegistro> {
  const response = await api.get("/admin/solicitudes-registro", {
    params: { pagina, porPagina, estado },
  });
  return response.data;
}

export async function resolverSolicitudRegistro(
  id: string,
  estado: "en-revision" | "resuelta" | "descartada",
  respuesta: string,
): Promise<{ message: string; solicitud: SolicitudRegistroAdmin }> {
  const response = await api.post(`/admin/solicitudes-registro/${id}/resolver`, {
    estado,
    respuesta,
  });
  return response.data;
}

export type ResumenAdmin = {
  generadoEn: string;
  periodoMes: { desde: string };
  usuarios: {
    total: number;
    activos: number;
    suspendidos: number;
    administradores: number;
    nuevos30Dias: number;
    cancelados: number;
  };
  catalogo: {
    productos: { total: number; activos: number };
    promocionales: { total: number; activos: number };
  };
  ventas: {
    total: number;
    ingresos: number;
    mes: { total: number; ingresos: number };
    porEstado: { estado: string; total: number; ingresos: number }[];
    ultimas: {
      id: number;
      producto: string;
      vendedor: string;
      monto: number;
      estado: string;
      fecha: string;
    }[];
  };
  reportes: { pendientes: number; total: number };
  filas: { activas: number };
  mensajes: { total: number };
  listaNegra: { total: number };
  ultimosUsuarios: UsuarioAdmin[];
};

export async function fetchResumenAdmin(): Promise<ResumenAdmin> {
  const response = await api.get("/admin/resumen");
  return response.data;
}

export type DisputaAdmin = {
  id: string;
  ventaIdPg: number;
  ventaMongoId: string | null;
  productoNombre: string;
  compradorId: string;
  vendedorId: number;
  vendedorNombre: string;
  monto: number;
  motivo: string;
  descripcion: string | null;
  evidenciasComprador: string[];
  respuestaVendedor: string | null;
  evidenciasVendedor: string[];
  respondidaEn: string | null;
  estado: string;
  resueltaEn: string | null;
  resueltaPor: string | null;
  notaAdmin: string | null;
  reembolsoId: string | null;
  ventaEstado: string | null;
  fecha: string;
};

export type VentaRetenidaAdmin = {
  ventaId: number;
  ventaMongoId: string | null;
  estado: string;
  monto: number;
  productoNombre: string;
  compradorId: string;
  vendedorId: number;
  vendedorNombre: string;
  canceladoMotivo: string | null;
  tieneDisputaAbierta: boolean;
  reportesPendientes: number;
  reportesConfirmados: number;
  fecha: string;
};

export type RespuestaDisputas = {
  disputas: DisputaAdmin[];
  ventasRetenidas: VentaRetenidaAdmin[];
  abiertas: number;
  pagina: number;
  porPagina: number;
  total: number;
  totalPaginas: number;
};

export async function fetchDisputasAdmin(
  pagina: number,
  porPagina: number,
  estado?: string,
): Promise<RespuestaDisputas> {
  const response = await api.get("/admin/disputas", {
    params: { pagina, porPagina, estado },
  });
  return response.data;
}

export type RespuestaDictamenDisputa = {
  message: string;
  dictamen: "reembolsar" | "rechazar";
  reembolsada: boolean;
  retencionLiberada: boolean;
  adeudoId?: string;
};

export async function resolverDisputaAdmin(
  id: string,
  dictamen: "reembolsar" | "rechazar",
  nota?: string,
): Promise<RespuestaDictamenDisputa> {
  const response = await api.post(`/admin/disputas/${id}/resolver`, {
    dictamen,
    nota,
  });
  return response.data;
}

export type RespuestaVentaRetenida = {
  message: string;
  ventaId: number;
  reembolsada: boolean;
  retencionLiberada: boolean;
  adeudoId?: string;
};

export async function resolverVentaRetenidaAdmin(
  ventaId: number,
  dictamen: "reembolsar" | "liberar",
  opciones: { causaAdeudo?: string; nota?: string } = {},
): Promise<RespuestaVentaRetenida> {
  const response = await api.post(
    `/admin/ventas-retenidas/${ventaId}/resolver`,
    { dictamen, causaAdeudo: opciones.causaAdeudo, nota: opciones.nota },
  );
  return response.data;
}

export type AdeudoAdmin = {
  id: string;
  usuarioId: number;
  vendedorNombre: string;
  ventaIdPg: number;
  productoNombre: string;
  monto: number;
  motivo: string;
  causa: string;
  estado: string;
  fecha: string;
  liquidadoEn: string | null;
  liquidadoPor: string | null;
  nota: string | null;
};

export type RespuestaAdeudos = {
  adeudos: AdeudoAdmin[];
  pagina: number;
  porPagina: number;
  total: number;
  totalPaginas: number;
  pendienteTotal: number;
};

export async function fetchAdeudosAdmin(
  pagina: number,
  porPagina: number,
  estado?: string,
): Promise<RespuestaAdeudos> {
  const response = await api.get("/admin/adeudos", {
    params: { pagina, porPagina, estado },
  });
  return response.data;
}

export type RespuestaLiquidacion = {
  message: string;
  adeudo: AdeudoAdmin;
  saldoPendiente: number;
  reactivado: boolean;
};

export async function liquidarAdeudoAdmin(
  id: string,
  nota?: string,
): Promise<RespuestaLiquidacion> {
  const response = await api.post(`/admin/adeudos/${id}/liquidar`, { nota });
  return response.data;
}

export const CAUSAS_ADEUDO_ADMIN: { valor: string; etiqueta: string }[] = [
  { valor: "", etiqueta: "No registrar adeudo" },
  { valor: "reporte_confirmado", etiqueta: "Reporte confirmado al vendedor" },
  { valor: "disputa_vendedor", etiqueta: "Disputa resuelta en su contra" },
  { valor: "sin_confirmar_comprobante", etiqueta: "No confirmó el comprobante" },
  { valor: "entrega_vencida", etiqueta: "Entrega fuera del plazo" },
  { valor: "inactividad_chat", etiqueta: "Inactividad en el chat" },
  { valor: "otro", etiqueta: "Otro motivo (irregularidad)" },
];

export function textoCausaAdeudo(causa: string): string {
  const encontrada = CAUSAS_ADEUDO_ADMIN.find((item) => item.valor === causa);
  return encontrada?.etiqueta ?? causa;
}

export type EntradaBitacora = {
  _id: string;
  actorTipo: "usuario" | "comprador" | "visitante" | "sistema";
  actorId: string | null;
  actorNombre: string | null;
  accion: string;
  descripcion: string;
  createdAt: string;
};

export async function fetchBitacora(filtros: {
  accion?: string;
  actor?: string;
}): Promise<EntradaBitacora[]> {
  const response = await api.get("/admin/bitacora", { params: filtros });
  return response.data;
}
