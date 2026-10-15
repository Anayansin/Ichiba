import api from "./api";

export async function crearOrdenPago(productoId: string) {
  const response = await api.post("/pagos/crear-orden", { productoId });
  return response.data;
}

export async function capturarOrdenPago(orderId: string) {
  const response = await api.post(`/pagos/capturar-orden/${orderId}`);
  return response.data;
}

/** Confirmación de vuelta del checkout de MercadoPago. */
export async function confirmarPagoMercadoPago(paymentId: string) {
  const response = await api.post("/pagos/confirmar-mercadopago", {
    paymentId,
  });
  return response.data;
}

/**
 * RQF4: pide al backend la URL de la pasarela oficial de PayPal para que el
 * vendedor autorice su cuenta con OAuth 2.0. El navegador sale hacia ahí.
 */
export async function iniciarVinculacionPayPal() {
  const response = await api.post("/pagos/paypal/vincular");
  return response.data as { url: string };
}

/** Estado de la vinculación (nunca devuelve el token, solo el Merchant ID). */
export async function estadoVinculacionPayPal() {
  const response = await api.get("/pagos/paypal/vinculacion");
  return response.data as {
    vinculado: boolean;
    correoPayPal: string | null;
    merchantId: string | null;
    vinculadoEn: string | null;
    metodoPago: string;
  };
}

/**
 * Estados del escrow (RQNF4):
 *  - pendiente_comprobante:  pagó; falta registrar su comprobante (RQF22).
 *  - pendiente_confirmacion: comprobante enviado; el vendedor lo revisa (RQF31).
 *  - en_entrega:             confirmado; chat abierto para coordinar (RQNF29).
 *  - completada:             entregado y dinero liberado (RQNF26/27).
 *  - reembolsada / cancelada: la compra terminó y el dinero volvió.
 */
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
  /** Fecha de la autorización del pago. */
  creada: string | null;
  producto: { nombre: string; imagenes: string[] } | null;
  /** RQNF20: palabra clave de 4 dígitos de la sesión de pago. */
  codigoPago: string | null;
  /** RQNF24.4: código que el comprador entrega en persona. */
  codigoEntrega: string | null;
  comprobanteEnviadoEn: string | null;
  confirmacionLimite: string | null;
  entregaLimite: string | null;
  entregadoEn: string | null;
  canceladoMotivo: string | null;
  chatHabilitado: boolean;
  calificacionComprador: number | null;
};

export type VentaDelVendedor = {
  ventaId: number;
  estado: EstadoVenta;
  monto: number;
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
  /** RQNF10.1 / RQNF10.3 / RQF12: estado de la cuenta y puntos acumulados. */
  cuenta: {
    estadoCuenta: string;
    puntosReputacion: number;
    puntosCancelacion: number;
  };
  /** RQNF10.1: promedio de calificaciones recibidas (null si aún no hay). */
  reputacion: number | null;
  resumen: { porRevisar: number; enEntrega: number; completadas: number };
  ventas: VentaDelVendedor[];
};

/**
 * RQF22 / RQNF20: el comprador registra su comprobante de pago (palabra clave
 * + referencia + fotografía). La imagen pasa antes por la moderación del
 * backend (RQNF18).
 */
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

/** RQF31: el vendedor confirma el comprobante recibido (abre el chat). */
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

/**
 * RQF31 / RQNF23: el vendedor rechaza el comprobante: se reembolsa al
 * comprador y el turno pasa al siguiente de la fila.
 */
export async function rechazarComprobanteDeVenta(
  ventaId: number,
  motivo: string,
) {
  const response = await api.post(`/pagos/${ventaId}/rechazar-comprobante`, {
    motivo,
  });
  return response.data as { message: string; estado: EstadoVenta };
}

/** RQF33 / RQNF27: el vendedor registra el código de entrega y se libera el dinero. */
export async function registrarEntregaDeVenta(
  ventaId: number,
  codigoEntrega: string,
) {
  const response = await api.post(`/pagos/${ventaId}/confirmar-entrega`, {
    codigoEntrega,
  });
  return response.data as { message: string; estado: EstadoVenta };
}

/** RQF30/RQF32/RQF33: ventas del vendedor para su panel de seguimiento. */
export async function fetchVentasDelVendedor(estado?: EstadoVenta) {
  const response = await api.get("/pagos/vendedor/ventas", {
    params: estado ? { estado } : undefined,
  });
  return response.data as ResumenVentasDelVendedor;
}

/** Seguimiento del escrow para el comprador (palabra clave, entrega, motivos). */
export async function fetchMisCompras() {
  const response = await api.get("/pagos/mis-compras");
  return response.data as { compras: CompraDelComprador[] };
}

/** Detalle de una compra; cada parte ve solo lo que le corresponde. */
export async function fetchDetalleDeVenta(ventaId: number) {
  const response = await api.get(`/pagos/${ventaId}/detalle`);
  return response.data as {
    ventaId: number;
    estado: EstadoVenta;
    rol: "comprador" | "vendedor";
    monto: number;
    producto: { id: string; nombre: string; imagenes: string[] } | null;
    codigoPago: string | null;
    codigoEntrega: string | null;
    canceladoMotivo: string | null;
    chatHabilitado: boolean;
    retenido: boolean;
  };
}

/**
 * La imagen del comprobante solo la ven las partes de la venta, así que no
 * se puede usar en un <img src> (el navegador no manda las cabeceras de
 * identificación). Se descarga como blob y se devuelve una URL temporal.
 */
export async function fetchImagenComprobante(
  ventaId: number,
): Promise<string> {
  const response = await api.get(`/pagos/comprobante/${ventaId}/imagen`, {
    responseType: "blob",
  });
  return URL.createObjectURL(response.data as Blob);
}

/** RQF27: calificación de 1 a 5 estrellas después de confirmada la entrega. */
export async function calificarVenta(
  ventaMongoId: string,
  datos: { quienCalifica: "comprador" | "vendedor"; puntuacion: number },
) {
  const response = await api.post(`/pagos/${ventaMongoId}/calificar`, datos);
  return response.data;
}
