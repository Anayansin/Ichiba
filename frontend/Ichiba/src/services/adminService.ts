import api from "./api";
import type { Mensaje } from "./mensajeService";

export type UsuarioAdmin = {
  id: string;
  nombreCompleto: string;
  correo: string;
  tipo: string;
  suspendido: boolean;
  /** RQNF10.1 / RQNF10.3: puntos por infracciones acumulados (8 = cancelación). */
  puntosReputacion: number;
  /** RQNF10.3 / RQF12: "activa" | "cancelada". */
  estadoCuenta: string;
  fechaRegistro: string | null;
  /** RQNF37 / RQNF38: motivo de la suspensión (p. ej. saldo_pendiente). */
  motivoSuspension?: string | null;
  /** RQNF37 / RQNF38: adeudo pendiente de liquidar. */
  saldoPendiente?: number;
  /** RQNF33 / RQNF34: fecha en que concluye el bloqueo temporal vigente. */
  sancionHasta?: string | null;
  /** RQNF34 / RQNF35: la sanción es indefinida. */
  sancionPermanente?: boolean;
  /** RQNF35: la cuenta está en revisión administrativa. */
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
  /** RQNF10.1: puntos que suma este reporte si el administrador lo confirma. */
  puntos: number;
  /** RQNF10.1: puntos que ya lleva acumulados el vendedor. */
  puntosReputacion: number;
  /** RQNF10.3: puntos con los que la cuenta se cancela (8). */
  puntosCancelacion: number;
  /** RQNF10.3 / RQF12: "activa" | "cancelada". */
  estadoCuenta: string;
  fecha: string;
};

export type RespuestaResolucion = {
  message: string;
  estado?: string;
  faltasLeves?: number;
  faltaGraveRegistrada?: boolean;
  /** RQNF10.1: puntos que sumó el reporte al confirmarse. */
  puntos?: number;
  /** RQNF10.1: puntos totales del vendedor después de confirmar. */
  puntosReputacion?: number;
  /** RQNF10.3: true si con este reporte la cuenta llegó a 8 puntos y se canceló. */
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

// ---------------------------------------------------------------------------
// Dashboard del administrador: cifras en vivo (se recalculan en cada lectura).
// ---------------------------------------------------------------------------

export type ResumenAdmin = {
  generadoEn: string;
  periodoMes: { desde: string };
  usuarios: {
    total: number;
    activos: number;
    suspendidos: number;
    administradores: number;
    nuevos30Dias: number;
    /** RQNF10.3: cuentas canceladas de forma permanente por llegar a 8 puntos. */
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
