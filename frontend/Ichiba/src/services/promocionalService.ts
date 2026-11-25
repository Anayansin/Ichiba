import api from "./api";

export type Promocional = {
  _id: string;
  nombre: string;
  precio: number;
  categoria: string;
  descripcion: string;
  condicionUso: string;
  coberturaEnvio: string;
  chatHabilitado: boolean;
  zonaComentariosHabilitada: boolean;
  imagenes: string[];
  vendedor: string;
  vendedorId: string;
  activo: boolean;
  createdAt: string;
};

export async function fetchPromocionales(
  tipo?: string | null,
): Promise<Promocional[]> {
  const response = await api.get("/promocionales", {
    params: tipo ? { categoria: tipo } : undefined,
  });
  return response.data;
}

export async function fetchPromocionalPorId(id: string): Promise<Promocional> {
  const response = await api.get(`/promocionales/${id}`);
  return response.data;
}

export async function crearPromocional(
  formData: FormData,
): Promise<Promocional> {
  const response = await api.post("/promocionales", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
}

export async function fetchMisPromocionales(): Promise<Promocional[]> {
  const response = await api.get("/promocionales/mios/lista");
  return response.data;
}

export async function cambiarEstadoPromocional(
  id: string,
): Promise<Promocional> {
  const response = await api.patch(`/promocionales/${id}/estado`);
  return response.data;
}

export async function eliminarPromocional(id: string) {
  const response = await api.delete(`/promocionales/${id}`);
  return response.data;
}

export type Comentario = {
  _id: string;
  promocionalId: string;
  texto: string;
  autorNombre: string;
  createdAt: string;
  respuesta?: { texto: string; fecha: string } | null;
};

export async function fetchComentarios(
  promocionalId: string,
): Promise<Comentario[]> {
  const response = await api.get(`/promocionales/${promocionalId}/comentarios`);
  return response.data;
}

export async function crearComentario(
  promocionalId: string,
  texto: string,
  autorNombre: string,
): Promise<Comentario> {
  const response = await api.post(
    `/promocionales/${promocionalId}/comentarios`,
    { texto, autorNombre },
  );
  return response.data;
}

export async function responderComentario(
  promocionalId: string,
  comentarioId: string,
  texto: string,
): Promise<Comentario> {
  const response = await api.post(
    `/promocionales/${promocionalId}/comentarios/${comentarioId}/respuesta`,
    { texto },
  );
  return response.data;
}

export type MensajeConsulta = {
  _id: string;
  promocionalId: string;
  compradorId: string;
  remitente: "comprador" | "vendedor";
  contenido: string;
  createdAt: string;
};

export type ConversacionConsulta = {
  promocionalId: string;
  promocionalNombre: string;
  compradorId: string;
  mensajes: MensajeConsulta[];
};

export async function fetchConsulta(
  promocionalId: string,
): Promise<MensajeConsulta[]> {
  const response = await api.get(`/promocionales/${promocionalId}/consulta`);
  return response.data;
}

export async function enviarConsulta(
  promocionalId: string,
  contenido: string,
): Promise<MensajeConsulta> {
  const response = await api.post(`/promocionales/${promocionalId}/consulta`, {
    contenido,
  });
  return response.data;
}

export async function fetchConsultasDelVendedor(): Promise<
  ConversacionConsulta[]
> {
  const response = await api.get("/promocionales/mios/consultas");
  return response.data;
}

export async function responderConsulta(
  promocionalId: string,
  compradorId: string,
  contenido: string,
): Promise<MensajeConsulta> {
  const response = await api.post(
    `/promocionales/${promocionalId}/consulta/${encodeURIComponent(compradorId)}`,
    { contenido },
  );
  return response.data;
}
