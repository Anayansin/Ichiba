import api from "./api";
import type { ReputacionVendedor } from "./usuarioServices";

export type OrdenDePagoPayPal = {
  orderId: string;
  linkAprobacion: string;
  avisoAtencion?: string;
};

export async function crearOrdenPago(
  productoId: string,
): Promise<OrdenDePagoPayPal> {
  const response = await api.post("/pagos/crear-orden", { productoId });
  return response.data;
}

export async function capturarOrdenPago(orderId: string) {
  const response = await api.post(`/pagos/capturar-orden/${orderId}`);
  return response.data;
}

export async function iniciarVinculacionPayPal() {
  const response = await api.post("/pagos/paypal/vincular");
  return response.data as { url: string };
}

export async function estadoVinculacionPayPal() {
  const response = await api.get("/pagos/paypal/vinculacion");
  return response.data as {
    vinculado: boolean;
    correoPayPal: string | null;
    merchantId: string | null;
    vinculadoEn: string | null;
  };
}

export type EstadoVenta =
  | "pendiente_comprobante"
  | "pendiente_confirmacion"
  | "en_entrega"
  | "completada"
  | "reembolsada"
  | "cancelada";

export type CompraDelComprador = {
  ventaId: number;
  ventaMongoId: string | null;
  estado: EstadoVenta;
  monto: number;
  creada: string | null;
  producto: { nombre: string; imagenes: string[] } | null;
  codigoPago: string | null;
  codigoEntrega: string | null;
  comprobanteEnviadoEn: string | null;
  confirmacionLimite: string | null;
  entregaLimite: string | null;
  entregadoEn: string | null;
  canceladoMotivo: string | null;
  chatHabilitado: boolean;
  calificacionComprador: number | null;
};

export type ComisionDeVenta = {
  porcentaje: number;
  base: number;
  iva: number;
  total: number;
  netoVendedor: number;
  cobrada: boolean;
  reembolsada: boolean;
};

export type VentaDelVendedor = {
  ventaId: number;
  estado: EstadoVenta;
  monto: number;
  comision: ComisionDeVenta;
  producto: { nombre: string; imagenes: string[] } | null;
  compradorId: string;
  comprobante: {
    referencia: string | null;
    imagen: string;
    enviadoEn: string | null;
  } | null;
  fechas: {
    creada: string | null;
    comprobanteEnviadoEn: string | null;
    confirmacionLimite: string | null;
    comprobanteConfirmadoEn: string | null;
    entregaLimite: string | null;
    entregadoEn: string | null;
  };
  canceladoMotivo: string | null;
};

export type ResumenVentasDelVendedor = {
  cuenta: {
    estadoCuenta: string;
    puntosReputacion: number;
    puntosCancelacion: number;
  };
  reputacion: ReputacionVendedor;
  resumen: {
    porRevisar: number;
    enEntrega: number;
    completadas: number;
    comisiones: {
      cobradas: number;
      porCobrar: number;
      netoRecibido: number;
      netoPorRecibir: number;
    };
  };
  ventas: VentaDelVendedor[];
};

export async function registrarComprobantePago(
  ventaId: number,
  datos: { palabraClave: string; referencia: string; imagen: File },
) {
  const formData = new FormData();
  formData.append("palabraClave", datos.palabraClave);
  formData.append("referencia", datos.referencia);
  formData.append("comprobante", datos.imagen);

  const response = await api.post(`/pagos/${ventaId}/comprobante`, formData);
  return response.data as {
    message: string;
    estado: EstadoVenta;
    confirmacionLimite: string | null;
  };
}

export async function confirmarComprobanteDeVenta(ventaId: number) {
  const response = await api.post(
    `/pagos/${ventaId}/confirmar-comprobante`,
  );
  return response.data as {
    message: string;
    estado: EstadoVenta;
    entregaLimite: string | null;
  };
}

export async function rechazarComprobanteDeVenta(
  ventaId: number,
  motivo: string,
) {
  const response = await api.post(`/pagos/${ventaId}/rechazar-comprobante`, {
    motivo,
  });
  return response.data as { message: string; estado: EstadoVenta };
}

export async function registrarEntregaDeVenta(
  ventaId: number,
  codigoEntrega: string,
) {
  const response = await api.post(`/pagos/${ventaId}/confirmar-entrega`, {
    codigoEntrega,
  });
  return response.data as { message: string; estado: EstadoVenta };
}

export async function fetchVentasDelVendedor(estado?: EstadoVenta) {
  const response = await api.get("/pagos/vendedor/ventas", {
    params: estado ? { estado } : undefined,
  });
  return response.data as ResumenVentasDelVendedor;
}

export async function fetchMisCompras() {
  const response = await api.get("/pagos/mis-compras");
  return response.data as { compras: CompraDelComprador[] };
}

export async function fetchDetalleDeVenta(ventaId: number) {
  const response = await api.get(`/pagos/${ventaId}/detalle`);
  return response.data as {
    ventaId: number;
    estado: EstadoVenta;
    rol: "comprador" | "vendedor";
    monto: number;
    comision?: ComisionDeVenta;
    producto: { id: string; nombre: string; imagenes: string[] } | null;
    codigoPago: string | null;
    codigoEntrega: string | null;
    canceladoMotivo: string | null;
    chatHabilitado: boolean;
    retenido: boolean;
  };
}

export async function fetchImagenComprobante(
  ventaId: number,
): Promise<string> {
  const response = await api.get(`/pagos/comprobante/${ventaId}/imagen`, {
    responseType: "blob",
  });
  return URL.createObjectURL(response.data as Blob);
}

export async function calificarVenta(
  ventaMongoId: string,
  datos: { quienCalifica: "comprador" | "vendedor"; puntuacion: number },
) {
  const response = await api.post(`/pagos/${ventaMongoId}/calificar`, datos);
  return response.data;
}

export type DisputaDeVenta = {
  id: string;
  ventaIdPg: number;
  ventaMongoId: string | null;
  productoNombre: string;
  compradorId: string;
  vendedorId: number;
  vendedorNombre: string;
  monto: number;
  motivo: string;
  descripcion: string | null;
  evidenciasComprador: string[];
  respuestaVendedor: string | null;
  evidenciasVendedor: string[];
  respondidaEn: string | null;
  estado: string;
  resueltaEn: string | null;
  resueltaPor: string | null;
  notaAdmin: string | null;
  reembolsoId: string | null;
  ventaEstado: string | null;
  fecha: string;
};

export async function abrirDisputaDeCompra(
  ventaId: number,
  datos: { motivo: string; descripcion: string; imagenes: File[] },
) {
  const formData = new FormData();
  formData.append("motivo", datos.motivo);
  formData.append("descripcion", datos.descripcion);
  for (const imagen of datos.imagenes.slice(0, 5)) {
    formData.append("evidencias", imagen);
  }

  const response = await api.post(`/pagos/${ventaId}/disputa`, formData);
  return response.data as { message: string; disputa: DisputaDeVenta };
}

export async function fetchMisDisputas() {
  const response = await api.get("/pagos/disputas/mis-disputas");
  return response.data as { disputas: DisputaDeVenta[] };
}

export async function fetchDisputasDelVendedor() {
  const response = await api.get("/pagos/vendedor/disputas");
  return response.data as { disputas: DisputaDeVenta[] };
}

export async function responderDisputaDeVenta(
  disputaId: string,
  datos: { respuesta: string; imagenes: File[] },
) {
  const formData = new FormData();
  formData.append("respuesta", datos.respuesta);
  for (const imagen of datos.imagenes.slice(0, 5)) {
    formData.append("evidencias", imagen);
  }

  const response = await api.post(
    `/pagos/disputas/${disputaId}/responder`,
    formData,
  );
  return response.data as { message: string; disputa: DisputaDeVenta };
}

export async function fetchEvidenciaDisputa(
  disputaId: string,
  lado: "comprador" | "vendedor",
  indice: number,
): Promise<string> {
  const response = await api.get(
    `/pagos/disputas/${disputaId}/evidencia/${lado}/${indice}`,
    { responseType: "blob" },
  );
  return URL.createObjectURL(response.data as Blob);
}
