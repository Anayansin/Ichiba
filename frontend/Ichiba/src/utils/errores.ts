type ErrorConRespuesta = {
  response?: { data?: { message?: string; campo?: string } };
};

export function mensajeDeError(error: unknown): string {
  if (typeof error === "object" && error !== null && "response" in error) {
    const mensaje = (error as ErrorConRespuesta).response?.data?.message;
    if (typeof mensaje === "string") return mensaje;
  }
  return "";
}

/**
 * RQNF8: campo de texto que el backend señaló con palabras no permitidas
 * (p. ej. "nombre" o "descripcion"), para enfocarlo y que el usuario pueda
 * corregirlo. Devuelve null si el backend no indicó ningún campo.
 */
export function campoDeError(error: unknown): string | null {
  if (typeof error === "object" && error !== null && "response" in error) {
    const campo = (error as ErrorConRespuesta).response?.data?.campo;
    if (typeof campo === "string" && campo) return campo;
  }
  return null;
}
