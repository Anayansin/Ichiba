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
