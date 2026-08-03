import api from "./api";

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
