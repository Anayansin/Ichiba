export async function obtenerAccessToken(): Promise<string> {
  const auth = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`,
  ).toString("base64");

  const respuesta = await fetch(
    `${process.env.PAYPAL_API_BASE}/v1/oauth2/token`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    },
  );

  const data = await respuesta.json();
  return data.access_token;
}

export async function crearOrdenPaypal(
  monto: number,
  paypalEmailVendedor: string,
  productoId: string,
) {
  const token = await obtenerAccessToken();

  const respuesta = await fetch(
    `${process.env.PAYPAL_API_BASE}/v2/checkout/orders`,
    {
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
            payee: { email_address: paypalEmailVendedor },
          },
        ],
        application_context: {
          return_url: `${process.env.FRONTEND_URL}/pago-exitoso`,
          cancel_url: `${process.env.FRONTEND_URL}/producto/${productoId}`,
          user_action: "PAY_NOW",
        },
      }),
    },
  );

  return respuesta.json();
}

export async function capturarOrdenPaypal(orderId: string) {
  const token = await obtenerAccessToken();

  const respuesta = await fetch(
    `${process.env.PAYPAL_API_BASE}/v2/checkout/orders/${orderId}/capture`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    },
  );

  return respuesta.json();
}
