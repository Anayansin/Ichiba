import api from "./api";

export async function enviarCodigoTelefono() {
  const response = await api.post("/verificacion/telefono/enviar");
  return response.data;
}

export async function verificarCodigoTelefono(codigo: string) {
  const response = await api.post("/verificacion/telefono/verificar", {
    codigo,
  });
  return response.data;
}

export async function enviarCodigoCorreo() {
  const response = await api.post("/verificacion/correo/enviar");
  return response.data;
}

export async function verificarCodigoCorreo(codigo: string) {
  const response = await api.post("/verificacion/correo/verificar", { codigo });
  return response.data;
}
