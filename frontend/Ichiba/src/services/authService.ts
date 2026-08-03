import api from "./api";

export type Usuario = {
  id: string;
  nombreCompleto: string;
  correo: string;
  tipo: string;
};

export type RespuestaAuth = {
  token: string;
  usuario: Usuario;
};

export async function loginUsuario(
  correo: string,
  password: string,
): Promise<RespuestaAuth> {
  const response = await api.post("/usuarios/login", { correo, password });
  return response.data;
}
