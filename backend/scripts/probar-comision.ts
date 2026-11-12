/**
 * Pruebas de RNF-PAG-19 / RNF-PAG-20 y del arreglo de OAuth de PayPal.
 *
 * No necesita PostgreSQL, MongoDB ni credenciales reales: levanta un mock
 * local de PayPal y comprueba el cuerpo exacto que se envía. Se ejecuta con:
 *
 *   node --harmony-temporal --import tsx scripts/probar-comision.ts
 */
import "dotenv/config";
import assert from "node:assert/strict";
import http from "node:http";
import {
  calcularComision,
  comisionDeVenta,
} from "../src/services/comisionService.js";
import {
  capturarAutorizacionPaypal,
  construirUrlVinculacionPaypal,
  crearOrdenPaypal,
  intercambiarCodigoPorToken,
  reembolsarCapturaPaypal,
} from "../src/services/paypalService.js";

let servidor: http.Server | null = null;
let basePaypal = "";
let ultimoCuerpo: any = null;
let ultimoToken: URLSearchParams | null = null;

function responder(
  res: http.ServerResponse,
  status: number,
  cuerpo: unknown,
): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(cuerpo));
}

function leerCuerpo(req: http.IncomingMessage): Promise<string> {
  return new Promise((ok) => {
    let datos = "";
    req.on("data", (trozo) => (datos += trozo));
    req.on("end", () => ok(datos));
  });
}

async function levantarMock(): Promise<void> {
  servidor = http.createServer(async (req, res) => {
    const ruta = new URL(req.url ?? "/", "http://127.0.0.1").pathname;
    const metodo = req.method ?? "GET";

    if (metodo === "POST" && ruta === "/v1/oauth2/token") {
      ultimoToken = new URLSearchParams(await leerCuerpo(req));
      return responder(res, 200, {
        access_token: "token-de-prueba",
        token_type: "Bearer",
        expires_in: 3600,
      });
    }

    if (metodo === "POST" && ruta === "/v2/checkout/orders") {
      ultimoCuerpo = JSON.parse(await leerCuerpo(req));
      return responder(res, 201, {
        id: "ORDER-COMISION-1",
        status: "CREATED",
        links: [
          {
            rel: "approve",
            href: "https://www.sandbox.paypal.com/checkoutnow?token=ORDER-COMISION-1",
          },
        ],
      });
    }

    if (
      metodo === "POST" &&
      ruta === "/v2/payments/authorizations/AUTH-COMISION-1/capture"
    ) {
      ultimoCuerpo = JSON.parse(await leerCuerpo(req));
      return responder(res, 201, {
        id: "CAP-COMISION-1",
        status: "COMPLETED",
      });
    }

    if (
      metodo === "POST" &&
      ruta === "/v2/payments/captures/CAP-COMISION-1/refund"
    ) {
      ultimoCuerpo = JSON.parse(await leerCuerpo(req));
      return responder(res, 201, {
        id: "REFUND-COMISION-1",
        status: "COMPLETED",
      });
    }

    return responder(res, 404, { name: "RESOURCE_NOT_FOUND" });
  });

  await new Promise<void>((ok, error) => {
    servidor!.once("error", error);
    servidor!.listen(0, "127.0.0.1", () => ok());
  });

  const direccion = servidor.address();
  if (!direccion || typeof direccion === "string") {
    throw new Error("No se pudo obtener el puerto del mock de PayPal");
  }
  basePaypal = `http://127.0.0.1:${direccion.port}`;

  process.env.PAYPAL_API_BASE = basePaypal;
  process.env.PAYPAL_CLIENT_ID = "cliente-de-prueba";
  process.env.PAYPAL_CLIENT_SECRET = "secreto-de-prueba";
  process.env.PAYPAL_PLATFORM_MERCHANT_ID = "ABCDEFGHJKLMN";
  process.env.PAYPAL_COMISION_MODO = "platform_fee";
  process.env.BACKEND_URL = "https://backend.ejemplo.mx";
  process.env.FRONTEND_URL = "https://ichiba.ejemplo.mx";
  delete process.env.PAYPAL_REDIRECT_URI;
}

function probarCalculo(): void {
  const mil = calcularComision(1000);
  assert.deepEqual(mil, {
    porcentaje: 5.8,
    base: 50,
    iva: 8,
    total: 58,
    netoVendedor: 942,
  });

  const cien = calcularComision(100);
  assert.equal(cien.total, 5.8);
  assert.equal(cien.netoVendedor, 94.2);

  const diez = calcularComision(10);
  assert.equal(diez.base, 0.5);
  assert.equal(diez.iva, 0.08);
  assert.equal(diez.total, 0.58);
  assert.equal(diez.netoVendedor, 9.42);

  for (const invalido of [0, -10, Number.NaN, Number.POSITIVE_INFINITY]) {
    const desglose = calcularComision(invalido);
    assert.equal(desglose.total, 0);
    assert.equal(desglose.netoVendedor, 0);
  }

  const completada = comisionDeVenta(1000, "completada");
  assert.equal(completada.cobrada, true);
  assert.equal(completada.total, 58);
  assert.equal(completada.netoVendedor, 942);

  for (const estado of ["reembolsada", "cancelada"]) {
    const desglose = comisionDeVenta(1000, estado);
    assert.equal(desglose.reembolsada, true);
    assert.equal(desglose.cobrada, false);
    assert.equal(desglose.total, 0);
    assert.equal(desglose.netoVendedor, 0);
  }

  const pendiente = comisionDeVenta(1000, "pendiente_confirmacion");
  assert.equal(pendiente.cobrada, false);
  assert.equal(pendiente.reembolsada, false);
  assert.equal(pendiente.total, 58);
  assert.equal(pendiente.netoVendedor, 942);

  console.log("✓ RNF-PAG-19: 5 % + IVA = 5.8 %, neto y estados correctos");
}

async function probarComisionAlCapturar(): Promise<void> {
  await crearOrdenPaypal(1000, "vendedor@ejemplo.mx", "producto-1");

  const unidad = ultimoCuerpo?.purchase_units?.[0];
  assert.equal(ultimoCuerpo?.intent, "AUTHORIZE");
  assert.equal(unidad?.payee?.email_address, "vendedor@ejemplo.mx");
  assert.equal(
    unidad?.payment_instruction,
    undefined,
    "La orden no debe llevar platform_fees: PayPal los exige al capturar",
  );

  await capturarAutorizacionPaypal("AUTH-COMISION-1", 1000);
  const instruccion = ultimoCuerpo?.payment_instruction;
  assert.equal(instruccion?.disbursement_mode, "INSTANT");
  assert.equal(instruccion?.platform_fees?.[0]?.amount?.value, "58.00");
  assert.equal(instruccion?.platform_fees?.[0]?.amount?.currency_code, "MXN");
  assert.equal(
    instruccion?.platform_fees?.[0]?.payee?.merchant_id,
    "ABCDEFGHJKLMN",
  );

  console.log(
    "✓ RNF-PAG-20: la captura de PayPal incluye platform_fees por $58.00",
  );
}

async function probarModoRegistro(): Promise<void> {
  process.env.PAYPAL_COMISION_MODO = "registro";
  await capturarAutorizacionPaypal("AUTH-COMISION-1", 1000);
  assert.equal(ultimoCuerpo?.payment_instruction, undefined);
  process.env.PAYPAL_COMISION_MODO = "platform_fee";
  console.log("✓ Modo registro: no envía platform_fees (solo desarrollo)");
}

async function probarMerchantIdOpcional(): Promise<void> {
  delete process.env.PAYPAL_PLATFORM_MERCHANT_ID;
  await capturarAutorizacionPaypal("AUTH-COMISION-1", 1000);
  const instruccion = ultimoCuerpo?.payment_instruction;
  assert.equal(instruccion?.platform_fees?.[0]?.amount?.value, "58.00");
  assert.equal(
    instruccion?.platform_fees?.[0]?.payee,
    undefined,
    "Sin Merchant ID, PayPal debe acreditar la comisión a la cuenta de la app",
  );

  process.env.PAYPAL_PLATFORM_MERCHANT_ID = "CORTO";
  await assert.rejects(
    () => capturarAutorizacionPaypal("AUTH-COMISION-1", 1000),
    /formato de PayPal/,
  );

  process.env.PAYPAL_PLATFORM_MERCHANT_ID = "ABCDEFGHJKLMN";
  console.log(
    "✓ Merchant ID opcional; si falta, la comisión va a la cuenta de la app",
  );
}

async function probarReembolsoConComision(): Promise<void> {
  await reembolsarCapturaPaypal(
    "CAP-COMISION-1",
    undefined,
    "Disputa resuelta",
    58,
  );
  const instruccion = ultimoCuerpo?.payment_instruction;
  assert.equal(instruccion?.platform_fees?.[0]?.amount?.value, "58.00");
  assert.equal(instruccion?.platform_fees?.[0]?.amount?.currency_code, "MXN");
  console.log(
    "✓ RNF-PAG-20: el reembolso devuelve la comisión con platform_fees",
  );
}

function probarOauth(): void {
  const url = new URL(construirUrlVinculacionPaypal("estado-123"));
  assert.equal(
    url.searchParams.get("redirect_uri"),
    "https://backend.ejemplo.mx/api/pagos/paypal/vincular/callback",
  );
  assert.equal(url.searchParams.get("scope"), "openid profile email");
  assert.equal(url.searchParams.get("state"), "estado-123");
  console.log("✓ OAuth: la URL incluye redirect_uri, email y state");
}

async function probarIntercambioToken(): Promise<void> {
  await intercambiarCodigoPorToken("codigo-de-prueba");
  assert.equal(ultimoToken?.get("grant_type"), "authorization_code");
  assert.equal(ultimoToken?.get("code"), "codigo-de-prueba");
  assert.equal(
    ultimoToken?.get("redirect_uri"),
    "https://backend.ejemplo.mx/api/pagos/paypal/vincular/callback",
  );
  console.log("✓ OAuth: el intercambio de token envía el mismo redirect_uri");
}

async function main(): Promise<void> {
  await levantarMock();
  probarCalculo();
  await probarComisionAlCapturar();
  await probarModoRegistro();
  await probarMerchantIdOpcional();
  await probarReembolsoConComision();
  probarOauth();
  await probarIntercambioToken();
  console.log("\nComisión y PayPal: todas las verificaciones pasaron.");
}

try {
  await main();
} catch (error) {
  console.error("\nFalló la verificación de comisión/PayPal:", error);
  process.exitCode = 1;
} finally {
  servidor?.close();
}
