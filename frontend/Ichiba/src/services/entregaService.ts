import api from "./api";

export type PropuestaEntrega = {
  lugar: string;
  fecha: string;
  hora: string;
  estado: "pendiente" | "aceptada" | "rechazada";
  registradaEn?: string;
  respondidaEn?: string;
};

export type DireccionEntrega = {
  nombreRecibe: string;
  calleNumero: string;
  colonia: string;
  codigoPostal: string;
  ciudad: string;
  estado: string;
  telefono: string;
  referencias: string;
};

export type DatosEnvio = {
  paqueteria: string;
  numeroGuia: string;
  fechaEstimada: string;
};

export type EstadoEntrega = {
  estadoVenta: string;
  metodoEntrega: "domicilio" | "tienda" | "punto-encuentro" | null;
  horarioEntregaInicio: string | null;
  horarioEntregaFin: string | null;
  propuesta: PropuestaEntrega | null;
  propuestasRechazadas: PropuestaEntrega[];
  direccion: DireccionEntrega | null;
  envio: DatosEnvio | null;
  rol: "comprador" | "vendedor";
};

function ruta(esVendedor: boolean, ventaId: string, accion = "") {
  return `/entregas/${esVendedor ? "vendedor" : "comprador"}/${ventaId}${accion}`;
}

export async function fetchEntrega(
  ventaId: string,
  esVendedor: boolean,
): Promise<EstadoEntrega> {
  const response = await api.get(ruta(esVendedor, ventaId));
  return response.data;
}

export async function enviarPropuesta(
  ventaId: string,
  datos: { lugar: string; fecha: string; hora: string },
): Promise<EstadoEntrega> {
  const response = await api.post(ruta(true, ventaId, "/propuesta"), datos);
  return response.data;
}

export async function responderPropuesta(
  ventaId: string,
  aceptar: boolean,
): Promise<EstadoEntrega> {
  const response = await api.post(ruta(false, ventaId, "/propuesta"), {
    aceptar,
  });
  return response.data;
}

export async function enviarDireccion(
  ventaId: string,
  datos: DireccionEntrega,
): Promise<EstadoEntrega> {
  const response = await api.post(ruta(false, ventaId, "/direccion"), datos);
  return response.data;
}

export async function enviarDatosEnvio(
  ventaId: string,
  datos: DatosEnvio,
): Promise<EstadoEntrega> {
  const response = await api.post(ruta(true, ventaId, "/envio"), datos);
  return response.data;
}
