import api from "./api";
import type { Producto } from "./productoService";

export type DatosRegistro = {
  nombreCompleto: string;
  direccion: string;
  telefono: string;
  correo: string;
  rfc: string;
  password: string;
};

export async function registrarUsuario(datos: DatosRegistro) {
  const response = await api.post("/usuarios/registro", datos);
  return response.data;
}

export type PerfilUsuario = {
  _id: string;
  nombreCompleto: string;
  correo: string;
  ventasExitosas: number;
  reportes: number;
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
