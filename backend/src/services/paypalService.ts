/**
 * Cliente de la API de PayPal (Checkout v2).
 *
 * Todas las llamadas verifican la configuración y el código de respuesta de
 * PayPal: antes los errores llegaban como JSON sin `access_token` ni `links`
 * y terminaban en un "500 genérico" imposible de diagnosticar.
 */

type VariablesPaypal = {
  clientId: string;
  clientSecret: string;
  apiBase: string;
};

function configuracionPaypal(): VariablesPaypal {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  const apiBase =
    process.env.PAYPAL_API_BASE ?? "https://api-m.sandbox.paypal.com";

  if (!clientId || !clientSecret) {
    const faltantes = [
      !clientId && "PAYPAL_CLIENT_ID",
      !clientSecret && "PAYPAL_CLIENT_SECRET",
    ]
      .filter(Boolean)
      .join(", ");
    throw new Error(
      `Faltan variables de PayPal en backend/.env: ${faltantes}`,
    );
  }

  return { clientId, clientSecret, apiBase };
}

function frontUrl(): string {
  const frontend = process.env.FRONTEND_URL ?? "http://localhost:5173";
  return frontend.replace(/\/$/, "");
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
      datos?.details?.[0]?.description ??
      datos?.message ??
      datos?.name ??
      texto.slice(0, 300);
    const error = new Error(
      `${contexto}: PayPal respondió ${respuesta.status} (${detalle})`,
    );
    (error as any).respuestaPaypal = datos;
    (error as any).codigoPaypal = respuesta.status;
    throw error;
  }

  return datos;
}

export async function obtenerAccessToken(): Promise<string> {
  const { clientId, clientSecret, apiBase } = configuracionPaypal();

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const respuesta = await fetch(`${apiBase}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  const data = await leerRespuesta(respuesta, "Autenticación");

  if (!data?.access_token) {
    throw new Error("Autenticación: PayPal no devolvió un token de acceso");
  }

  return data.access_token;
}

export async function crearOrdenPaypal(
  monto: number,
  paypalEmailVendedor: string,
  productoId: string,
  merchantIdVendedor?: string | null,
) {
  const { apiBase } = configuracionPaypal();
  const token = await obtenerAccessToken();

  const respuesta = await fetch(`${apiBase}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: productoId,
          amount: { currency_code: "MXN", value: monto.toFixed(2) },
          // RQNF4: si el vendedor vinculó su cuenta (OAuth 2.0), los fondos
          // se dirigen a su Merchant ID; si no, al correo que escribió.
          payee: merchantIdVendedor
            ? { merchant_id: merchantIdVendedor }
            : { email_address: paypalEmailVendedor },
        },
      ],
      application_context: {
        return_url: `${frontUrl()}/pago-exitoso`,
        cancel_url: `${frontUrl()}/producto/${productoId}`,
        user_action: "PAY_NOW",
      },
    }),
  });

  return leerRespuesta(respuesta, "Crear orden");
}

export async function capturarOrdenPaypal(orderId: string) {
  const { apiBase } = configuracionPaypal();
  const token = await obtenerAccessToken();

  const respuesta = await fetch(
    `${apiBase}/v2/checkout/orders/${orderId}/capture`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    },
  );

  return leerRespuesta(respuesta, "Capturar orden");
}

/** Consulta el estado de una orden (se usa cuando ya fue capturada). */
export async function obtenerOrdenPaypal(orderId: string) {
  const { apiBase } = configuracionPaypal();
  const token = await obtenerAccessToken();

  const respuesta = await fetch(`${apiBase}/v2/checkout/orders/${orderId}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  return leerRespuesta(respuesta, "Consultar orden");
}

/**
 * RQF4 — Vinculación de la cuenta del vendedor con OAuth 2.0.
 *
 * El vendedor no "escribe" su correo y ya: el sistema lo redirige a la
 * pasarela oficial de PayPal (paypal.com / sandbox.paypal.com) para que él
 * mismo autorice el acceso con su cuenta. PayPal regresa al backend un
 * `code` de un solo uso que se intercambia por el Token de Acceso.
 */

/** Dirección oficial a la que se redirige al vendedor (nodo seguro de PayPal). */
function urlAutorizacionPaypal(): string {
  const { apiBase } = configuracionPaypal();
  return apiBase.includes("sandbox")
    ? "https://www.sandbox.paypal.com/webapps/oauth2/authorize"
    : "https://www.paypal.com/webapps/oauth2/authorize";
}

/** URL de regreso que PayPal llama tras autorizar (debe estar dada de alta en la app). */
function redirectUriPaypal(): string {
  const backend = (process.env.BACKEND_URL ?? "http://localhost:5000").replace(
    /\/+$/,
    "",
  );
  return `${backend}/api/pagos/paypal/vincular/callback`;
}

/**
 * Construye la URL de la pasarela oficial con la que se redirige al vendedor.
 * `estado` es un valor aleatorio que PayPal devuelve sin modificar (CSRF).
 */
export function construirUrlVinculacionPaypal(estado: string): string {
  const { clientId } = configuracionPaypal();

  const parametros = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    scope: "openid profile",
    redirect_uri: redirectUriPaypal(),
    state: estado,
  });

  return `${urlAutorizacionPaypal()}?${parametros.toString()}`;
}

/**
 * Intercambia el `code` que PayPal regresa por el Token de Acceso (y de
 * refresco) de la cuenta del vendedor. Un `code` solo puede usarse una vez.
 */
export async function intercambiarCodigoPorToken(codigo: string) {
  const { clientId, clientSecret, apiBase } = configuracionPaypal();
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const respuesta = await fetch(`${apiBase}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: codigo,
    }).toString(),
  });

  const datos = await leerRespuesta(respuesta, "Vinculación (token)");

  if (!datos?.access_token) {
    throw new Error(
      "Vinculación: PayPal no devolvió un token de acceso válido",
    );
  }

  return datos as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    token_type?: string;
  };
}

/**
 * Identidad de la cuenta que autorizó: devuelve el `payer_id`, que es el
 * Merchant ID con el que PayPal identifica al vendedor para mover los fondos.
 */
export async function identidadPaypal(tokenDeUsuario: string) {
  const { apiBase } = configuracionPaypal();

  const respuesta = await fetch(`${apiBase}/v1/identity/oauth2/userinfo`, {
    method: "GET",
    headers: { Authorization: `Bearer ${tokenDeUsuario}` },
  });

  const datos = await leerRespuesta(respuesta, "Vinculación (identidad)");

  return datos as {
    payer_id?: string;
    email?: string;
    emails?: { value: string; primary?: boolean }[];
    given_name?: string;
    family_name?: string;
  };
}
