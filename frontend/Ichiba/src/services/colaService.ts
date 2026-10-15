import api from "./api";

export type Fila = {
  _id: string;
  productoId: {
    _id: string;
    nombre: string;
    imagenes: string[];
    precio: number;
  } | null;
  estado: string;
};

export async function entrarEnFila(productoId: string): Promise<Fila> {
  const response = await api.post("/colas/entrar", { productoId });
  return response.data;
}

export async function fetchMisFilas(): Promise<Fila[]> {
  const response = await api.get("/colas/mias");
  return response.data;
}

export async function salirDeFila(id: string) {
  const response = await api.patch(`/colas/${id}/salir`);
  return response.data;
}

/**
 * RQF18: guarda el lugar en la fila y pausa el reloj de pago hasta la
 * próxima apertura del vendedor.
 */
export async function esperarProximaApertura(
  id: string,
): Promise<{ message: string; proximoBloque: string | null }> {
  const response = await api.patch(`/colas/${id}/esperar-apertura`);
  return response.data;
}

export type EstadoFila = {
  posicion: number | null;
  puedePagar: boolean;
  colaId: string | null;
  pagoExpiraEn?: string | null;
  expiro?: boolean;
  mensaje?: string;
  enFila?: boolean;
  /** RQF18: el comprador está esperando la próxima apertura del vendedor. */
  esperandoApertura?: boolean;
  /** RQF18: en su turno puede elegir esperar a la próxima apertura. */
  puedeElegirEspera?: boolean;
  /** RQNF16: advertencia previa al pago (bloque por terminar). */
  avisoAtencion?: string | null;
  /** RQNF15: texto del próximo bloque de atención del vendedor. */
  proximoBloque?: string | null;
  /** RQNF15: el vendedor atiende en este momento (sin horarios = siempre). */
  horarioActivo?: boolean;
};

export async function fetchEstadoDeMiFila(
  productoId: string,
): Promise<EstadoFila> {
  const response = await api.get(`/colas/producto/${productoId}/estado`);
  return response.data;
}
