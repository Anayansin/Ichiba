import { calcularComision } from "./comisionService.js";

type VariablesPaypal = {
  clientId: string;
  clientSecret: string;
  apiBase: string;
};

let advertenciasProduccionMostradas = false;

function advertirConfiguracionProduccion(apiBase: string): void {
  if (
    advertenciasProduccionMostradas ||
    process.env.NODE_ENV !== "production"
  ) {
    return;
  }
  advertenciasProduccionMostradas = true;

  if (apiBase.includes("sandbox")) {
    console.error(
      "[paypal] PAYPAL_API_BASE apunta a sandbox con NODE_ENV=production: los pagos reales no funcionarán. Usa https://api-m.paypal.com.",
    );
  }
  if (modoComisionPaypal() === "registro") {
    console.error(
      "[paypal] PAYPAL_COMISION_MODO=registro con NODE_ENV=production: la comisión se muestra pero NO se cobra. Cambia a platform_fee cuando PayPal apruebe Complete Payments.",
    );
  }
}

function configuracionPaypal(): VariablesPaypal {
  const clientId = process.env.PAYPAL_CLIENT_ID?.trim();
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET?.trim();
  const apiBase = (
    process.env.PAYPAL_API_BASE?.trim() ||
    "https://api-m.sandbox.paypal.com"
  ).replace(/\/+$/, "");

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

  advertirConfiguracionProduccion(apiBase);

  return { clientId, clientSecret, apiBase };
}

// FRONTEND_URL puede traer varias direcciones separadas por comas (CORS);
// los regresos desde PayPal usan la primera.
export function frontUrl(): string {
  const frontend =
    (process.env.FRONTEND_URL ?? "")
      .split(",")
      .map((origen) => origen.trim())
      .find(Boolean) || "http://localhost:5173";
  return frontend.replace(/\/+$/, "");
}

type ModoComisionPaypal = "platform_fee" | "registro";

function modoComisionPaypal(): ModoComisionPaypal {
  const modo = (process.env.PAYPAL_COMISION_MODO ?? "platform_fee")
    .trim()
    .toLowerCase();
  return modo === "registro" ? "registro" : "platform_fee";
}

export function comisionPaypalActiva(): boolean {
  return modoComisionPaypal() === "platform_fee";
}

function instruccionComisionPaypal(monto: number) {
  if (modoComisionPaypal() === "registro") return null;

  const merchantIdPlataforma =
    process.env.PAYPAL_PLATFORM_MERCHANT_ID?.trim();

  if (
    merchantIdPlataforma &&
    !/^[2-9A-HJ-NP-Z]{13}$/.test(merchantIdPlataforma)
  ) {
    throw new Error(
      "PAYPAL_PLATFORM_MERCHANT_ID no tiene el formato de PayPal: deben ser 13 caracteres (sin 0, 1, I ni O). Copia el Merchant ID de la cuenta de plataforma o deja la variable vacía.",
    );
  }

  const { total } = calcularComision(monto);
  if (total <= 0) return null;

  return {
    disbursement_mode: "INSTANT",
    platform_fees: [
      {
        amount: { currency_code: "MXN", value: total.toFixed(2) },
        ...(merchantIdPlataforma
          ? { payee: { merchant_id: merchantIdPlataforma } }
          : {}),
      },
    ],
  };
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
  compradorId?: string,
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
      intent: "AUTHORIZE",
      purchase_units: [
        {
          reference_id: productoId,
          ...(compradorId ? { custom_id: compradorId.slice(0, 127) } : {}),
          amount: { currency_code: "MXN", value: monto.toFixed(2) },
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

export async function autorizarOrdenPaypal(orderId: string) {
  const { apiBase } = configuracionPaypal();
  const token = await obtenerAccessToken();

  const respuesta = await fetch(
    `${apiBase}/v2/checkout/orders/${orderId}/authorize`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    },
  );

  return leerRespuesta(respuesta, "Autorizar orden");
}

export async function capturarAutorizacionPaypal(
  authorizationId: string,
  monto?: number,
) {
  const { apiBase } = configuracionPaypal();
  const token = await obtenerAccessToken();
  const pagoComision = instruccionComisionPaypal(monto ?? 0);

  const respuesta = await fetch(
    `${apiBase}/v2/payments/authorizations/${authorizationId}/capture`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(
        pagoComision ? { payment_instruction: pagoComision } : {},
      ),
    },
  );

  return leerRespuesta(respuesta, "Capturar autorización (escrow)");
}

export async function anularAutorizacionPaypal(authorizationId: string) {
  const { apiBase } = configuracionPaypal();
  const token = await obtenerAccessToken();

  const respuesta = await fetch(
    `${apiBase}/v2/payments/authorizations/${authorizationId}/void`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (respuesta.status === 204) return { ok: true };

  return leerRespuesta(respuesta, "Anular autorización (escrow)");
}

export async function reembolsarCapturaPaypal(
  captureId: string,
  monto?: number,
  motivo?: string,
  comision?: number,
) {
  const { apiBase } = configuracionPaypal();
  const token = await obtenerAccessToken();

  const cuerpoBase = {
    ...(monto
      ? { amount: { currency_code: "MXN", value: monto.toFixed(2) } }
      : {}),
    ...(motivo ? { note_to_payer: motivo.slice(0, 255) } : {}),
  };

  async function solicitar(incluirComision: boolean) {
    const respuesta = await fetch(
      `${apiBase}/v2/payments/captures/${captureId}/refund`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...cuerpoBase,
          ...(incluirComision && comision && comision > 0
            ? {
                payment_instruction: {
                  platform_fees: [
                    {
                      amount: {
                        currency_code: "MXN",
                        value: comision.toFixed(2),
                      },
                    },
                  ],
                },
              }
            : {}),
        }),
      },
    );

    return leerRespuesta(respuesta, "Reembolsar captura");
  }

  const conComision = Boolean(comision && comision > 0);

  try {
    return await solicitar(conComision);
  } catch (error) {
    const detalle = JSON.stringify((error as any)?.respuestaPaypal ?? "");
    if (
      !conComision ||
      !/platform|fee|permission|not.authorized|invalid/i.test(detalle)
    ) {
      throw error;
    }

    console.warn(
      "[paypal] El reembolso con comisión no fue aceptado; se reintenta sin platform_fees. Revisa el ajuste de la comisión de plataforma.",
    );
    return solicitar(false);
  }
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

export async function obtenerCapturaPaypal(captureId: string) {
  const { apiBase } = configuracionPaypal();
  const token = await obtenerAccessToken();

  const respuesta = await fetch(`${apiBase}/v2/payments/captures/${captureId}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  return leerRespuesta(respuesta, "Consultar captura");
}

export function paypalEnSandbox(): boolean {
  const apiBase =
    process.env.PAYPAL_API_BASE?.trim() || "https://api-m.sandbox.paypal.com";
  return apiBase.includes("sandbox");
}

function urlAutorizacionPaypal(): string {
  return paypalEnSandbox()
    ? "https://www.sandbox.paypal.com/signin/authorize"
    : "https://www.paypal.com/signin/authorize";
}

function redirectUriPaypal(): string {
  const configurada = process.env.PAYPAL_REDIRECT_URI?.trim();
  if (configurada) return configurada;

  const backend = (
    process.env.BACKEND_URL?.trim() || "http://localhost:5000"
  ).replace(/\/+$/, "");
  return `${backend}/api/pagos/paypal/vincular/callback`;
}

export function construirUrlVinculacionPaypal(estado: string): string {
  const { clientId } = configuracionPaypal();

  const parametros = new URLSearchParams({
    flowEntry: "static",
    client_id: clientId,
    response_type: "code",
    scope: "openid profile email",
    redirect_uri: redirectUriPaypal(),
    state: estado,
  });

  return `${urlAutorizacionPaypal()}?${parametros.toString()}`;
}

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
      redirect_uri: redirectUriPaypal(),
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

export async function verificarFirmaWebhookPaypal(
  cabeceras: Record<string, string | string[] | undefined>,
  evento: unknown,
): Promise<boolean> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID?.trim();
  if (!webhookId) {
    console.warn("[paypal] PAYPAL_WEBHOOK_ID no está configurado: el webhook se ignora");
    return false;
  }
  const valor = (nombre: string) => {
    const dato = cabeceras[nombre];
    return Array.isArray(dato) ? dato[0] : dato;
  };
  const { apiBase } = configuracionPaypal();
  const token = await obtenerAccessToken();
  const respuesta = await fetch(`${apiBase}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      auth_algo: valor("paypal-auth-algo"),
      cert_url: valor("paypal-cert-url"),
      transmission_id: valor("paypal-transmission-id"),
      transmission_sig: valor("paypal-transmission-sig"),
      transmission_time: valor("paypal-transmission-time"),
      webhook_id: webhookId,
      webhook_event: evento,
    }),
  });
  if (!respuesta.ok) return false;
  const datos = (await respuesta.json()) as { verification_status?: string };
  return datos.verification_status === "SUCCESS";
}
