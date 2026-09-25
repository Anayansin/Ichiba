import api from "./api";
import type { Producto } from "./productoService";

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
