/**
 * Cliente de la API de MercadoPago (Checkout API / Payment Brick).
 *
 * El formulario de pago vive DENTRO de Ichiba: el navegador monta el Payment
 * Brick (tarjeta, OXXO, SPEI) con la llave pública de la cuenta y, al
 * enviarlo, el método elegido y la tarjeta tokenizada llegan aquí para crear
 * el pago con `POST /v1/payments`. A diferencia de Checkout Pro ya no hay
 * preferencia ni `init_point`: el cobro se crea directamente y su estado
 * (aprobado, pendiente, rechazado) es la respuesta.
 *
 * DIFERENCIA IMPORTANTE CON PAYPAL: en PayPal el dinero va directo a la
 * cuenta del vendedor, porque se envía su correo como `payee`. En MercadoPago
 * el dinero entra en la cuenta dueña de este Access Token; pagarle a cada
 * vendedor exigiría el programa Marketplace de MercadoPago. Mientras eso no
 * se active, este cobro es del propietario de la credencial.
 *
 * Las credenciales viven en backend/.env (nunca en git):
 *   MERCADOPAGO_ACCESS_TOKEN  obligatorio, de mercadopago.com/developers
 *   MERCADOPAGO_PUBLIC_KEY    obligatorio para el Payment Brick (es pública)
 *   MERCADOPAGO_API_BASE      opcional, por defecto https://api.mercadopago.com
 *   BACKEND_URL               opcional; si existe se notifica por webhook (IPN)
 */

type VariablesMercadoPago = {
  accessToken: string;
  apiBase: string;
};

function configuracionMercadoPago(): VariablesMercadoPago {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  const apiBase =
    process.env.MERCADOPAGO_API_BASE ?? "https://api.mercadopago.com";

  if (!accessToken) {
    throw new Error(
      "Falta la variable MERCADOPAGO_ACCESS_TOKEN en backend/.env. " +
        "Se obtiene en mercadopago.com/developers > Tu cuenta > Credenciales.",
    );
  }

  return { accessToken, apiBase };
}

/**
 * Llave pública de la cuenta: la usa el navegador para montar el Payment
 * Brick. No es un secreto (viaja al comprador en cada pago), pero sin ella el
 * formulario embebido no puede renderizarse.
 */
export function llavePublicaMercadoPago(): string {
  const llave = process.env.MERCADOPAGO_PUBLIC_KEY;

  if (!llave) {
    throw new Error(
      "Falta la variable MERCADOPAGO_PUBLIC_KEY en backend/.env (llave " +
        "pública de MercadoPago; se usa para montar el formulario de pago).",
    );
  }

  return llave;
}

/**
 * URL pública del backend. Solo existe si se define `BACKEND_URL`; se usa
 * para el webhook (MercadoPago rechaza o ignora URLs que no pueda alcanzar,
 * como localhost).
 */
function backUrl(): string | null {
  const valor = process.env.BACKEND_URL?.trim().replace(/\/+$/, "");
  return valor ? valor : null;
}

async function leerRespuesta(respuesta: Response, contexto: string) {
  const texto = await respuesta.text();
  let datos: any = null;
  try {
    datos = texto ? JSON.parse(texto) : null;
  } catch {
    datos = { raw: texto };
  }

  if (!respuesta.ok) {
    const detalle =
      datos?.message ??
      datos?.error ??
      datos?.cause?.[0]?.description ??
      texto.slice(0, 300);
    const error = new Error(
      `${contexto}: MercadoPago respondió ${respuesta.status} (${detalle})`,
    );
    (error as any).respuestaMercadoPago = datos;
    (error as any).codigoMercadoPago = respuesta.status;
    throw error;
  }

  return datos;
}

async function llamarApi(
  metodo: string,
  ruta: string,
  contexto: string,
  cuerpo?: unknown,
) {
  const { accessToken, apiBase } = configuracionMercadoPago();

  const respuesta = await fetch(`${apiBase}${ruta}`, {
    method: metodo,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": `${Date.now()}`,
    },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });

  return leerRespuesta(respuesta, contexto);
}

export type DatosPagoMercadoPago = {
  productoId: string;
  compradorId: string;
  titulo: string;
  precio: number;
  /** Lo que mandó el Payment Brick: método elegido, tarjeta tokenizada, etc. */
  pago: {
    token?: string;
    payment_method_id?: string;
    issuer_id?: string | number;
    installments?: string | number;
    payer?: {
      email?: string;
      identification?: { type?: string; number?: string };
    };
  };
};

/**
 * Crea el pago con el formulario del Brick. La tarjeta llega tokenizada
 * (nunca vemos el número); OXXO/SPEI llegan sin token y quedan pendientes
 * hasta que el comprador pague. La referencia `mp:<productoId>` y los
 * metadatos del comprador permiten registrar la venta tanto aquí como desde
 * el webhook.
 */
export async function crearPagoMercadoPago(datos: DatosPagoMercadoPago) {
  const baseBack = backUrl();
  const pago = datos.pago ?? {};

  if (!pago.payment_method_id) {
    throw new Error("El formulario de pago no indicó el método de pago");
  }

  const cuerpo: Record<string, unknown> = {
    // El importe lo fija el servidor con el precio actual del producto.
    transaction_amount: datos.precio,
    description: datos.titulo.slice(0, 256),
    payment_method_id: pago.payment_method_id,
    ...(pago.token ? { token: pago.token } : {}),
    ...(pago.issuer_id !== undefined ? { issuer_id: pago.issuer_id } : {}),
    ...(pago.installments !== undefined
      ? { installments: Number(pago.installments) }
      : {}),
    ...(pago.payer ? { payer: pago.payer } : {}),
    external_reference: `mp:${datos.productoId}`,
    metadata: { productoId: datos.productoId, compradorId: datos.compradorId },
    statement_descriptor: "ICHIBA",
    ...(baseBack && baseBack.startsWith("https://")
      ? { notification_url: `${baseBack}/api/pagos/webhook-mercadopago` }
      : {}),
  };

  return llamarApi("POST", "/v1/payments", "Crear pago", cuerpo);
}

/**
 * Consulta un pago por su id. Es la única fuente de verdad para confirmar:
 * el estado puede ser `approved`, `pending`, `rejected`, `cancelled`, etc.
 */
export async function obtenerPagoMercadoPago(paymentId: string) {
  return llamarApi(
    "GET",
    `/v1/payments/${encodeURIComponent(paymentId)}`,
    "Consultar pago",
  );
}

/** ¿El pago quedó efectivamente cobrado? */
export function pagoAprobado(pago: { status?: string } | null): boolean {
  return pago?.status === "approved";
}

/**
 * RQNF23 / RQNF24 / RQNF28 / RQNF31: devuelve al comprador el dinero de un
 * pago ya acreditado. En MercadoPago el cobro entra a la cuenta dueña de la
 * credencial, así que este reembolso es el mecanismo para "soltar" el escrow
 * interno cuando la transacción se cancela (en PayPal se usa la anulación de
 * la autorización antes de capturar, o el reembolso de la captura).
 */
export async function reembolsarPagoMercadoPago(
  paymentId: string,
  monto?: number,
) {
  return llamarApi(
    "POST",
    `/v1/payments/${encodeURIComponent(paymentId)}/refunds`,
    "Reembolsar pago",
    monto !== undefined ? { amount: monto } : {},
  );
}
