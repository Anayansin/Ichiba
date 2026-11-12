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

/**
 * RQNF1.9: código con el que el backend avisa que el alta fue denegada
 * ("DATOS_NO_REGISTRABLES"). Permite mostrar el mensaje de bloqueo con su
 * opción de solicitar revisión a los administradores.
 */
export function codigoDeError(error: unknown): string | null {
  if (typeof error === "object" && error !== null && "response" in error) {
    const codigo = (error as ErrorConRespuesta).response?.data?.codigo;
    if (typeof codigo === "string" && codigo) return codigo;
  }
  return null;
}

/** Motivo del bloqueo que devuelve el backend (lista negra, datos en uso, etc.). */
export function motivoDeError(error: unknown): string | null {
  if (typeof error === "object" && error !== null && "response" in error) {
    const motivo = (error as ErrorConRespuesta).response?.data?.motivo;
    if (typeof motivo === "string" && motivo) return motivo;
  }
  return null;
}
