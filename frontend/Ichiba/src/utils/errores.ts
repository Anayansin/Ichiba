type ErrorConRespuesta = {
  response?: {
    data?: { message?: string; campo?: string; codigo?: string; motivo?: string };
  };
};

export function mensajeDeError(error: unknown): string {
  if (typeof error === "object" && error !== null && "response" in error) {
    const mensaje = (error as ErrorConRespuesta).response?.data?.message;
    if (typeof mensaje === "string") return mensaje;
  }
  return "";
}

export function campoDeError(error: unknown): string | null {
  if (typeof error === "object" && error !== null && "response" in error) {
    const campo = (error as ErrorConRespuesta).response?.data?.campo;
    if (typeof campo === "string" && campo) return campo;
  }
  return null;
}

export function codigoDeError(error: unknown): string | null {
  if (typeof error === "object" && error !== null && "response" in error) {
    const codigo = (error as ErrorConRespuesta).response?.data?.codigo;
    if (typeof codigo === "string" && codigo) return codigo;
  }
  return null;
}

export function motivoDeError(error: unknown): string | null {
  if (typeof error === "object" && error !== null && "response" in error) {
    const motivo = (error as ErrorConRespuesta).response?.data?.motivo;
    if (typeof motivo === "string" && motivo) return motivo;
  }
  return null;
}
