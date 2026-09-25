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

export async function solicitarRecuperacion(correo: string) {
  const response = await api.post("/usuarios/recuperar/solicitar", { correo });
  return response.data;
}

export async function verificarCodigoRecuperacion(
  correo: string,
  codigo: string,
) {
  const response = await api.post("/usuarios/recuperar/verificar", {
    correo,
    codigo,
  });
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
