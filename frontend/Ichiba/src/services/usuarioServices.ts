import api from "./api";
import type { Producto } from "./productoService";
import type { BloqueHorario } from "../components/SelectorHorario/SelectorHorario";

export type DatosRegistro = {
  nombreCompleto: string;
  direccion: string;
  telefono: string;
  correo: string;
  rfc: string;
  password: string;
  aceptaTerminos: boolean;
  recibirNotificacionesCriticas: boolean;
  ineFrente: File;
  ineReverso: File;
  recibirNotificacionesPublicitarias: boolean;
  metodoPago: "paypal" | "mercadopago";
  datosMetodoPago: string;
  horarios: BloqueHorario[];
};

export async function registrarUsuario(datos: DatosRegistro) {
  const formData = new FormData();
  formData.append("nombreCompleto", datos.nombreCompleto);
  formData.append("direccion", datos.direccion);
  formData.append("telefono", datos.telefono);
  formData.append("correo", datos.correo);
  formData.append("rfc", datos.rfc);
  formData.append("password", datos.password);
  formData.append("aceptaTerminos", String(datos.aceptaTerminos));
  formData.append(
    "recibirNotificacionesCriticas",
    String(datos.recibirNotificacionesCriticas),
  );
  formData.append("ineFrente", datos.ineFrente);
  formData.append("ineReverso", datos.ineReverso);
  formData.append(
    "recibirNotificacionesPublicitarias",
    String(datos.recibirNotificacionesPublicitarias),
  );
  formData.append("metodoPago", datos.metodoPago);
  formData.append("datosMetodoPago", datos.datosMetodoPago);
  formData.append("horarios", JSON.stringify(datos.horarios));

  const response = await api.post("/usuarios/registro", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
}

export type PerfilUsuario = {
  id: number;
  nombreCompleto: string;
  correo: string;
  ventasExitosas: number;
  totalReportes: number;
  correoVerificado: boolean;
  horarios: BloqueHorario[];
};

export async function fetchPerfil(): Promise<PerfilUsuario> {
  const response = await api.get("/usuarios/perfil");
  return response.data;
}

export type PerfilPublico = {
  usuario: {
    id: number;
    nombreCompleto: string;
    ventasExitosas: number;
    totalReportes: number;
  };
  productos: Producto[];
  vendedorDisponibleAhora: boolean;
  proximoBloque: string | null;
};

export async function fetchPerfilPublico(id: string): Promise<PerfilPublico> {
  const response = await api.get(`/usuarios/${id}/publico`);
  return response.data;
}

export async function solicitarRecuperacion(correo: string) {
  const response = await api.post("/usuarios/recuperar/solicitar", { correo });
  return response.data;
}

export async function restablecerPassword(
  correo: string,
  codigo: string,
  password: string,
) {
  const response = await api.post("/usuarios/recuperar/restablecer", {
    correo,
    codigo,
    password,
  });
  return response.data;
}
