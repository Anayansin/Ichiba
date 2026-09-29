type ErrorConRespuesta = {
  response?: { data?: { message?: string } };
};

export function mensajeDeError(error: unknown): string {
  if (typeof error === "object" && error !== null && "response" in error) {
    const mensaje = (error as ErrorConRespuesta).response?.data?.message;
    if (typeof mensaje === "string") return mensaje;
  }
  return "";
}
