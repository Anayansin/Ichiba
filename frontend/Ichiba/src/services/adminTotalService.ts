import api from "./api";

export type Paginado<T> = {
  elementos: T[];
  pagina: number;
  porPagina: number;
  total: number;
  totalPaginas: number;
};

export type PublicacionAdmin = {
  _id: string;
  tipo: "producto" | "promocional";
  nombre: string;
  descripcion: string;
  precio: number;
  categoria: string;
  condicionUso: string | null;
  imagenes: string[];
  vendedor: string;
  vendedorId: string;
  activo: boolean;
  metodoEntrega: string | null;
  coberturaEnvio: string | null;
  chatHabilitado: boolean | null;
  zonaComentariosHabilitada: boolean | null;
  creadoEn: string | null;
  actualizadoEn: string | null;
};

export async function fetchPublicacionesAdmin(filtros: {
  q?: string;
  tipo?: string;
  estado?: string;
  pagina?: number;
}): Promise<Paginado<PublicacionAdmin>> {
  const response = await api.get("/admin/publicaciones", { params: filtros });
  return response.data;
}

export async function editarPublicacionAdmin(
  tipo: string,
  id: string,
  cambios: Partial<
    Pick<
      PublicacionAdmin,
      | "nombre"
      | "descripcion"
      | "precio"
      | "categoria"
      | "activo"
      | "chatHabilitado"
      | "zonaComentariosHabilitada"
    >
  >,
): Promise<{ message: string }> {
  const response = await api.patch(`/admin/publicaciones/${tipo}/${id}`, cambios);
  return response.data;
}

export type UsuarioDetalleAdmin = {
  id: string;
  nombreCompleto: string;
  correo: string;
  telefono: string;
  direccion: string;
  rfc: string;
  curp: string | null;
  ineCodigoReverso: string | null;
  paypalEmail: string;
  tipo: string;
  estadoCuenta: string;
  suspendido: boolean;
  motivoSuspension: string | null;
  saldoPendiente: number;
  puntosReputacion: number;
  ventasExitosas: number;
  totalReportes: number;
  correoVerificado: boolean;
  tieneIneFrente: boolean;
  tieneIneReverso: boolean;
  createdAt: string;
  totales: { productos: number; promocionales: number; ventas: number };
};

export async function fetchUsuarioDetalleAdmin(
  id: string,
): Promise<UsuarioDetalleAdmin> {
  const response = await api.get(`/admin/usuarios/${id}/detalle`);
  return response.data;
}

export type CambiosUsuarioAdmin = Partial<
  Pick<
    UsuarioDetalleAdmin,
    | "nombreCompleto"
    | "correo"
    | "telefono"
    | "direccion"
    | "rfc"
    | "curp"
    | "paypalEmail"
    | "tipo"
  >
>;

export async function editarUsuarioAdmin(
  id: string,
  cambios: CambiosUsuarioAdmin,
): Promise<{ message: string; usuario: UsuarioDetalleAdmin }> {
  const response = await api.patch(`/admin/usuarios/${id}/datos`, cambios);
  return response.data;
}

export type TransaccionAdmin = {
  _id: string;
  ventaIdPg: number | null;
  productoId: string;
  productoNombre: string;
  vendedorId: string;
  vendedorNombre: string;
  compradorId: string;
  compradorNombre: string;
  monto: number;
  estado: string;
  estadoTexto: string;
  motivo: string;
  retenido: boolean;
  disputa: {
    _id: string;
    estado: string;
    motivo: string;
    descripcion: string;
    respuestaVendedor: string;
    notaAdmin: string;
  } | null;
  reportes: number;
  totalMensajes: number;
  ultimoMensaje: string | null;
  paypalOrderId: string;
  creadoEn: string | null;
  actualizadoEn: string | null;
};

export async function fetchTransaccionesAdmin(filtros: {
  q?: string;
  estado?: string;
  problema?: string;
  pagina?: number;
}): Promise<Paginado<TransaccionAdmin>> {
  const response = await api.get("/admin/transacciones", { params: filtros });
  return response.data;
}

export type TipoConversacion = "venta" | "consulta" | "comentarios";

export type ConversacionAdmin = {
  tipo: TipoConversacion;
  id: string;
  titulo: string;
  enlace: string;
  participantes: string;
  totalMensajes: number;
  ultimaFecha: string | null;
  vistaPrevia: string;
  disputa: string | null;
  reportes: number;
  retenido: boolean;
};

export async function fetchConversacionesAdmin(filtros: {
  q?: string;
  tipo?: string;
  problema?: string;
  pagina?: number;
}): Promise<Paginado<ConversacionAdmin>> {
  const response = await api.get("/admin/conversaciones", { params: filtros });
  return response.data;
}

export type ReporteDeMensaje = {
  categoria: string;
  detalle: string | null;
  estado: string;
};

export type MensajeAdmin = {
  _id: string;
  autor: string;
  rol: "vendedor" | "comprador" | "visitante";
  contenido: string;
  imagen: string | null;
  fecha: string | null;
  reportes: ReporteDeMensaje[];
};

export type DetalleConversacionAdmin = {
  tipo: TipoConversacion;
  titulo: string;
  participantes?: string;
  venta?: TransaccionAdmin;
  reportesDeLaVenta?: ReporteDeMensaje[];
  mensajes: MensajeAdmin[];
};

export async function fetchConversacionAdmin(
  tipo: TipoConversacion,
  id: string,
): Promise<DetalleConversacionAdmin> {
  const response = await api.get(
    `/admin/conversaciones/${tipo}/${encodeURIComponent(id)}`,
  );
  return response.data;
}

export type QuejaAdmin = {
  _id: string;
  autorTipo: "usuario" | "comprador";
  nombre: string;
  correo: string;
  asunto: string;
  mensaje: string;
  referencia: string;
  estado: "abierta" | "en_revision" | "atendida";
  respuestaAdmin: string;
  creadaEn: string | null;
  atendidaEn: string | null;
};

export async function fetchQuejasAdmin(filtros: {
  q?: string;
  estado?: string;
  pagina?: number;
}): Promise<Paginado<QuejaAdmin> & { abiertas: number }> {
  const response = await api.get("/admin/quejas", { params: filtros });
  return response.data;
}

export async function actualizarQuejaAdmin(
  id: string,
  cambios: { estado?: string; respuestaAdmin?: string },
): Promise<{ message: string }> {
  const response = await api.patch(`/admin/quejas/${id}`, cambios);
  return response.data;
}

export type ReporteCompletoAdmin = {
  id: number;
  elemento: string;
  categoria: string;
  tipoFalta: string;
  detalle: string;
  estado: string;
  reportado: string;
  reportadoPor: string;
  ventaIdPg: string | null;
  mensajeId: string | null;
  contenidoReportado: string | null;
  creadoEn: string | null;
};

export async function fetchTodosLosReportesAdmin(filtros: {
  q?: string;
  estado?: string;
  pagina?: number;
}): Promise<Paginado<ReporteCompletoAdmin>> {
  const response = await api.get("/admin/reportes/todos", { params: filtros });
  return response.data;
}

export const ASUNTOS_QUEJA: { id: string; nombre: string }[] = [
  { id: "compra", nombre: "Una compra" },
  { id: "vendedor", nombre: "Un vendedor" },
  { id: "pago", nombre: "Un pago o reembolso" },
  { id: "entrega", nombre: "Una entrega" },
  { id: "plataforma", nombre: "El funcionamiento de Ichiba" },
  { id: "otro", nombre: "Otro tema" },
];

export async function enviarQueja(datos: {
  asunto: string;
  mensaje: string;
  referencia?: string;
  nombre?: string;
  correo?: string;
}): Promise<{ message: string }> {
  const response = await api.post("/quejas", datos);
  return response.data;
}
