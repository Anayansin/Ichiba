import api from "./api";
import type { Producto } from "./productoService";

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

  const response = await api.post("/usuarios/registro", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
}

export type PerfilUsuario = {
  _id: string;
  nombreCompleto: string;
  correo: string;
  ventasExitosas: number;
  reportes: number;
  telefonoVerificado: boolean;
  correoVerificado: boolean;
};

export async function fetchPerfil(): Promise<PerfilUsuario> {
  const response = await api.get("/usuarios/perfil");
  return response.data;
}

export type PerfilPublico = {
  usuario: {
    _id: string;
    nombreCompleto: string;
    ventasExitosas: number;
    reportes: number;
  };
  productos: Producto[];
};

export async function fetchPerfilPublico(id: string): Promise<PerfilPublico> {
  const response = await api.get(`/usuarios/${id}/publico`);
  return response.data;
}
