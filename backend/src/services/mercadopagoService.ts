/**
 * Cliente de la API de MercadoPago (Checkout Pro).
 *
 * Checkout Pro crea una "preferencia" de pago y devuelve `init_point`: la
 * página alojada de MercadoPago donde el comprador paga con tarjeta, OXXO,
 * SPEI o saldo de MercadoPago. A diferencia de PayPal aquí NO hay un paso de
 * "captura": el cobro queda aprobado al momento y se confirma consultándolo
 * con `obtenerPago()`, lo que además hace la confirmación idempotente.
 *
 * DIFERENCIA IMPORTANTE CON PAYPAL: en PayPal el dinero va directo a la
 * cuenta del vendedor, porque se envía su correo como `payee`. En Checkout
 * Pro el dinero entra en la cuenta dueña de este Access Token; pagarle a
 * cada vendedor exigiría el programa Marketplace de MercadoPago. Mientras
 * eso no se active, este cobro es del propietario de la credencial.
 *
 * Las credenciales viven en backend/.env (nunca en git):
 *   MERCADOPAGO_ACCESS_TOKEN  obligatorio, de mercadopago.com/developers
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

/** URL pública del frontend, sin barra final. */
function frontUrl(): string {
  return (process.env.FRONTEND_URL ?? "http://localhost:5173").replace(
    /\/+$/,
    "",
  );
}

/**
 * URL pública del backend. Solo existe si se define `BACKEND_URL`; se usa
 * para el webhook y para servir la foto del producto dentro de la página de
 * pago (las imágenes las entrega el backend, no el frontend).
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

export type DatosPreferencia = {
  productoId: string;
  compradorId: string;
  titulo: string;
  descripcion: string;
  precio: number;
  /** Ruta relativa (`/uploads/...`) o URL absoluta de la primera foto. */
  imagen?: string | null;
};

/**
 * Crea la preferencia de pago y devuelve `init_point`, el enlace al que hay
 * que redirigir al comprador (el mismo campo `linkAprobacion` que usa
 * PayPal, así el frontend no distingue entre pasarelas).
 */
export async function crearPreferenciaMercadoPago(datos: DatosPreferencia) {
  const baseFront = frontUrl();
  const baseBack = backUrl();

  // `auto_return` redirige solo al comprador al terminar, pero MercadoPago
  // solo lo acepta con URLs https: en desarrollo (localhost) se omite y el
  // comprador pulsa el botón de vuelta al sitio.
  const puedeAutoReturn = baseFront.startsWith("https://");

  let imagenAbsoluta: string | undefined;
  if (datos.imagen) {
    if (/^https?:\/\//i.test(datos.imagen)) {
      imagenAbsoluta = datos.imagen;
    } else if (baseBack) {
      imagenAbsoluta = `${baseBack}${datos.imagen.startsWith("/") ? "" : "/"}${datos.imagen}`;
    }
  }

  const cuerpo: Record<string, unknown> = {
    items: [
      {
        id: datos.productoId,
        title: datos.titulo.slice(0, 256),
        description: datos.descripcion.slice(0, 600),
        quantity: 1,
        unit_price: datos.precio,
        currency_id: "MXN",
        ...(imagenAbsoluta ? { picture_url: imagenAbsoluta } : {}),
      },
    ],
    back_urls: {
      success: `${baseFront}/pago-exitoso?fuente=mercadopago`,
      failure: `${baseFront}/producto/${datos.productoId}`,
      pending: `${baseFront}/producto/${datos.productoId}`,
    },
    // MercadoPago lo devuelve tal cual en la vuelta: con él recuperamos el
    // producto sin depender de la sesión del navegador.
    external_reference: `mp:${datos.productoId}`,
    metadata: {
      productoId: datos.productoId,
      compradorId: datos.compradorId,
    },
    statement_descriptor: "ICHIBA",
    expires: false,
    ...(puedeAutoReturn ? { auto_return: "approved" } : {}),
    ...(baseBack
      ? { notification_url: `${baseBack}/api/pagos/webhook-mercadopago` }
      : {}),
  };

  return llamarApi("POST", "/checkout/preferences", "Crear preferencia", cuerpo);
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
