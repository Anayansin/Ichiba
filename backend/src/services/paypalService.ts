/**
 * Cliente de la API de PayPal (Checkout v2).
 *
 * Todas las llamadas verifican la configuración y el código de respuesta de
 * PayPal: antes los errores llegaban como JSON sin `access_token` ni `links`
 * y terminaban en un "500 genérico" imposible de diagnosticar.
 */

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

function frontUrl(): string {
  const frontend =
    process.env.FRONTEND_URL?.trim() || "http://localhost:5173";
  return frontend.replace(/\/+$/, "");
}

type ModoComisionPaypal = "platform_fee" | "registro";

/**
 * `platform_fee` cobra la comisión real con PayPal Complete Payments.
 * `registro` solo la muestra/registra (desarrollo o mientras PayPal aprueba
 * la cuenta de plataforma); nunca debe usarse para declarar la comisión como
 * cobrada en producción.
 */
function modoComisionPaypal(): ModoComisionPaypal {
  const modo = (process.env.PAYPAL_COMISION_MODO ?? "platform_fee")
    .trim()
    .toLowerCase();
  return modo === "registro" ? "registro" : "platform_fee";
}

/** Indica si la comisión real de PayPal está activa. */
export function comisionPaypalActiva(): boolean {
  return modoComisionPaypal() === "platform_fee";
}

/**
 * Instrucción de PayPal para cobrar la comisión de Ichiba al capturar la
 * autorización del escrow. Requiere una cuenta habilitada para PayPal Complete
 * Payments Platform (Marketplaces and Platforms) y vendedores enrolados en la
 * plataforma con la función PARTNER_FEE.
 *
 * El `payee` de `platform_fees` es opcional. Si se omite, PayPal acredita la
 * comisión a la cuenta dueña de la app (la plataforma). `PAYPAL_PLATFORM_MERCHANT_ID`
 * solo se usa cuando PayPal pide indicar explícitamente esa cuenta.
 */
function instruccionComisionPaypal(monto: number) {
  if (modoComisionPaypal() === "registro") return null;

  const merchantIdPlataforma =
    process.env.PAYPAL_PLATFORM_MERCHANT_ID?.trim();

  // Si se configura, debe tener el formato exacto de PayPal. Validarlo aquí
  // evita una orden rechazada con un error críptico.
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
    // El escrow ya retuvo el dinero antes de capturar; al liberar, el neto se
    // dispersa de inmediato al vendedor y la comisión a la plataforma.
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
      // RQNF4: captura diferida (escrow). Con `AUTHORIZE` el comprador
      // aprueba el pago, pero el dinero queda retenido hasta que el sistema
      // captura la autorización (al registrarse el código de entrega) o la
      // anula si la transacción se cancela.
      intent: "AUTHORIZE",
      purchase_units: [
        {
          reference_id: productoId,
          amount: { currency_code: "MXN", value: monto.toFixed(2) },
          // RQNF4: si el vendedor vinculó su cuenta (OAuth 2.0), los fondos
          // se dirigen a su Merchant ID; si no, al correo que escribió.
          payee: merchantIdVendedor
            ? { merchant_id: merchantIdVendedor }
            : { email_address: paypalEmailVendedor },
          // RNF-PAG-20: la comisión no se envía aquí: PayPal la exige en la
          // captura de la autorización (ver capturarAutorizacionPaypal).
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

/**
 * RQNF4 (escrow): autoriza la orden aprobada por el comprador. PayPal retiene
 * el dinero de su instrumento de pago y devuelve una autorización que después
 * se captura (paga al vendedor) o se anula (liberación sin cobro).
 */
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

/**
 * RQNF27: captura la autorización para liberar los fondos retenidos en escrow
 * hacia la cuenta del vendedor (se llama al registrarse el código de entrega).
 */
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
      // RNF-PAG-20: PayPal exige `payment_instruction` en la captura de una
      // autorización (intent=AUTHORIZE), no al crear la orden. Aquí se retiene
      // la comisión de Ichiba y se dispersa el neto al vendedor.
      body: JSON.stringify(
        pagoComision ? { payment_instruction: pagoComision } : {},
      ),
    },
  );

  return leerRespuesta(respuesta, "Capturar autorización (escrow)");
}

/**
 * RQNF23 / RQNF28: anula la autorización. El comprador nunca alcanza a pagar:
 * PayPal libera la retención sin mover dinero.
 */
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

  // PayPal responde 204 sin cuerpo cuando la anulación es correcta.
  if (respuesta.status === 204) return { ok: true };

  return leerRespuesta(respuesta, "Anular autorización (escrow)");
}

/**
 * Reembolso de una captura ya realizada (disputas resueltas a favor del
 * comprador después de liberar los fondos).
 */
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

  /**
   * RNF-PAG-20: al reembolsar una venta completada también se devuelve la
   * comisión. En la API de PayPal `platform_fees.amount` es la parte del
   * reembolso que aporta la plataforma, así que se envía el total cobrado.
   */
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
    // Compatibilidad con ventas anteriores a la comisión o con cuentas que
    // todavía no tienen habilitado Complete Payments: primero se garantiza
    // el reembolso al comprador y se deja constancia del ajuste pendiente.
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

/**
 * URL de regreso que PayPal llama tras autorizar. Debe coincidir exactamente
 * con la registrada en la app de PayPal. `PAYPAL_REDIRECT_URI` permite fijarla
 * explícitamente cuando el backend usa un dominio distinto al público.
 */
function redirectUriPaypal(): string {
  const configurada = process.env.PAYPAL_REDIRECT_URI?.trim();
  if (configurada) return configurada;

  const backend = (
    process.env.BACKEND_URL?.trim() || "http://localhost:5000"
  ).replace(/\/+$/, "");
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
    // `email` es necesario para obtener el correo de la cuenta vinculada;
    // `payer_id` sigue siendo el Merchant ID que recibe los fondos.
    scope: "openid profile email",
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
      // PayPal exige el mismo redirect_uri del paso de autorización al
      // intercambiar el código; sin él responde invalid_grant.
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
