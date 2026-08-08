import api from "./api";

export type Fila = {
  _id: string;
  productoId: {
    _id: string;
    nombre: string;
    imagenes: string[];
    precio: number;
  };
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

export type EstadoFila = {
  posicion: number;
  puedePagar: boolean;
  colaId: string;
};

export async function fetchEstadoDeMiFila(
  productoId: string,
): Promise<EstadoFila> {
  const response = await api.get(`/colas/producto/${productoId}/estado`);
  return response.data;
}
