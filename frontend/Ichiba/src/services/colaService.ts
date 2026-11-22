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
  posicion: number;
};

export type AvisoFila = {
  _id: string;
  motivoCierre: string;
  cerradaEn: string;
  producto: string | null;
};

export async function fetchAvisosFilas(): Promise<AvisoFila[]> {
  const response = await api.get("/colas/avisos");
  return response.data;
}

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
  esperandoApertura?: boolean;
  puedeElegirEspera?: boolean;
  avisoAtencion?: string | null;
  proximoBloque?: string | null;
  horarioActivo?: boolean;
};

export async function fetchEstadoDeMiFila(
  productoId: string,
): Promise<EstadoFila> {
  const response = await api.get(`/colas/producto/${productoId}/estado`);
  return response.data;
}
