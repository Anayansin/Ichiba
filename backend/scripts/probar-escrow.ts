/**
 * Pruebas E2E de RQNF4 (escrow: dinero retenido hasta la entrega), RQNF20
 * (palabra clave de pago), RQNF23/23.2/24/24.1/24.2/24.4 (comprobante, plazos
 * por bloques de atención y fila en reposo), RQNF26/29/30 (chat de
 * coordinación), RQNF27 (captura diferida de PayPal / reembolso de
 * MercadoPago), RQNF28 (plazo de entrega de 15 días), RQNF31 (inactividad del
 * chat), RQNF32 (retención por reembolso fallido), RQNF37/RQNF38 (adeudo y
 * suspensión por saldo cuando la cancelación automática es por culpa directa
 * del vendedor) y RQF22/26/27/30/31/33.
 *
 * Levanta:
 *  - un mock local de PayPal (orden AUTHORIZE, autorización, captura,
 *    anulación y reembolso),
 *  - un mock local de MercadoPago (preferencias, pagos y reembolsos),
 *  - un mock local de Cloud Vision (etiquetas para publicar productos y
 *    SafeSearch para moderar comprobantes),
 *  - un backend de prueba en el puerto 5097 (correos a consola), y
 *  - el job `revisarEntregasVencidas()` dentro de este mismo proceso para
 *    probar las cancelaciones automáticas (mismo PostgreSQL y MongoDB).
 *
 * Nota: mientras corren las pruebas, este proceso marca las ventas ajenas
 * como `retenido` para que el job no las toque, y las restaura al terminar.
 * Las ventas de prueba también nacen retenidas y se "liberan" justo antes de
 * cada corrida del job, para que el cron de un backend de desarrollo no se
 * adelante.
 *
 * Uso (con MongoDB y PostgreSQL locales corriendo):
 *   node --harmony-temporal --import tsx scripts/probar-escrow.ts
 */
import "dotenv/config";
import { spawn, type ChildProcess } from "child_process";
import http from "http";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import sharp from "sharp";
import clientePrisma from "../src/configuracion/prisma.js";
import { Producto } from "../src/models/producto.js";
import { Venta } from "../src/models/Venta.js";
import { Usuario } from "../src/models/usuario.js";
import { Adeudo } from "../src/models/Adeudo.js";
import { revisarEntregasVencidas } from "../src/jobs/revisionEntregas.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(__dirname, "..");

const PUERTO_BACKEND = 5097;
const PUERTO_MOCK_PAYPAL = 59092;
const PUERTO_MOCK_VISION = 59091;
const PUERTO_MOCK_MP = 59093;
const BASE = `http://127.0.0.1:${PUERTO_BACKEND}`;

// --- Variables de los mocks: se fijan ANTES de que corran los servicios ----
process.env.PAYPAL_API_BASE = `http://127.0.0.1:${PUERTO_MOCK_PAYPAL}`;
process.env.PAYPAL_CLIENT_ID = "cliente-de-prueba";
process.env.PAYPAL_CLIENT_SECRET = "secreto-de-prueba";
process.env.MERCADOPAGO_ACCESS_TOKEN = "token-de-prueba";
process.env.MERCADOPAGO_API_BASE = `http://127.0.0.1:${PUERTO_MOCK_MP}`;
process.env.GOOGLE_VISION_API_KEY = "clave-de-prueba";
process.env.GOOGLE_VISION_ENDPOINT = `http://127.0.0.1:${PUERTO_MOCK_VISION}/v1/images:annotate`;
// Correos a consola: las pruebas no envían correo real.
process.env.GMAIL_USER = "";
process.env.GMAIL_APP_PASSWORD = "";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
type OrdenPaypalMock = {
  id: string;
  productoId: string;
  monto: string;
  autorizada: boolean;
  autorizacionId: string;
  capturada: boolean;
};

const paypalMock = {
  secuencia: 0,
  intents: [] as string[],
  payees: [] as string[],
  ordenes: new Map<string, OrdenPaypalMock>(),
  autorizacionesRegistradas: 0,
  capturas: new Map<string, string>(),
  anulaciones: new Set<string>(),
  reembolsos: 0,
  fallarAnulacion: new Set<string>(),
  consultasDeOrden: 0,
};

const safeSearchMock = {
  adult: "VERY_UNLIKELY",
  spoof: "VERY_UNLIKELY",
  violence: "VERY_UNLIKELY",
  racy: "VERY_UNLIKELY",
};

const mercadoPagoMock = {
  secuenciaPreferencias: 0,
  preferencias: [] as any[],
  reembolsos: [] as string[],
  pago: null as any,
};

function responder(
  res: http.ServerResponse,
  status: number,
  cuerpo: unknown,
): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(cuerpo));
}

function leerCuerpo(req: http.IncomingMessage): Promise<any> {
  return new Promise((ok) => {
    let datos = "";
    req.on("data", (trozo) => (datos += trozo));
    req.on("end", () => {
      try {
        ok(datos ? JSON.parse(datos) : {});
      } catch {
        ok({});
      }
    });
  });
}

function ordenPaypalComoRespuesta(orden: OrdenPaypalMock) {
  return {
    id: orden.id,
    status: "COMPLETED",
    purchase_units: [
      {
        reference_id: orden.productoId,
        amount: { currency_code: "MXN", value: orden.monto },
        payments: {
          authorizations: [
            {
              id: orden.autorizacionId,
              status: orden.capturada ? "CAPTURED" : "CREATED",
              amount: { currency_code: "MXN", value: orden.monto },
            },
          ],
        },
      },
    ],
  };
}

const servidorPaypal = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  const ruta = url.pathname;
  const metodo = req.method ?? "GET";

  if (metodo === "POST" && ruta === "/v1/oauth2/token") {
    return responder(res, 200, {
      access_token: "token-de-prueba",
      token_type: "Bearer",
      expires_in: 32400,
    });
  }

  if (metodo === "POST" && ruta === "/v2/checkout/orders") {
    const cuerpo = await leerCuerpo(req);
    paypalMock.intents.push(String(cuerpo?.intent ?? ""));
    const unidad = cuerpo?.purchase_units?.[0] ?? {};
    paypalMock.payees.push(
      String(unidad?.payee?.email_address ?? unidad?.payee?.merchant_id ?? ""),
    );

    const id = `ORDER-${++paypalMock.secuencia}`;
    const orden: OrdenPaypalMock = {
      id,
      productoId: String(unidad?.reference_id ?? ""),
      monto: String(unidad?.amount?.value ?? ""),
      autorizada: false,
      autorizacionId: `AUTH-${id}`,
      capturada: false,
    };
    paypalMock.ordenes.set(id, orden);

    return responder(res, 201, {
      id,
      status: "CREATED",
      links: [
        {
          rel: "approve",
          href: `https://www.sandbox.paypal.com/checkoutnow?token=${id}`,
        },
      ],
    });
  }

  const coincideAutorizar = ruta.match(
    /^\/v2\/checkout\/orders\/([^/]+)\/authorize$/,
  );
  if (metodo === "POST" && coincideAutorizar) {
    const orden = paypalMock.ordenes.get(decodeURIComponent(coincideAutorizar[1]));
    if (!orden) return responder(res, 404, { name: "RESOURCE_NOT_FOUND" });
    if (orden.autorizada) {
      return responder(res, 422, { name: "ORDER_ALREADY_AUTHORIZED" });
    }
    orden.autorizada = true;
    paypalMock.autorizacionesRegistradas += 1;
    return responder(res, 201, ordenPaypalComoRespuesta(orden));
  }

  const coincideConsultar = ruta.match(/^\/v2\/checkout\/orders\/([^/]+)$/);
  if (metodo === "GET" && coincideConsultar) {
    const orden = paypalMock.ordenes.get(decodeURIComponent(coincideConsultar[1]));
    if (!orden) return responder(res, 404, { name: "RESOURCE_NOT_FOUND" });
    paypalMock.consultasDeOrden += 1;
    return responder(res, 200, ordenPaypalComoRespuesta(orden));
  }

  const coincideCapturar = ruta.match(
    /^\/v2\/payments\/authorizations\/([^/]+)\/capture$/,
  );
  if (metodo === "POST" && coincideCapturar) {
    const authId = decodeURIComponent(coincideCapturar[1]);
    const orden = [...paypalMock.ordenes.values()].find(
      (candidata) => candidata.autorizacionId === authId,
    );
    if (!orden) return responder(res, 404, { name: "RESOURCE_NOT_FOUND" });
    orden.capturada = true;
    const capturaId = `CAP-${authId}`;
    paypalMock.capturas.set(authId, capturaId);
    return responder(res, 201, { id: capturaId, status: "COMPLETED" });
  }

  const coincideAnular = ruta.match(
    /^\/v2\/payments\/authorizations\/([^/]+)\/void$/,
  );
  if (metodo === "POST" && coincideAnular) {
    const authId = decodeURIComponent(coincideAnular[1]);
    if (paypalMock.fallarAnulacion.has(authId)) {
      return responder(res, 500, {
        name: "INTERNAL_SERVER_ERROR",
        message: "fallo simulado de anulación",
      });
    }
    paypalMock.anulaciones.add(authId);
    res.writeHead(204);
    return res.end();
  }

  const coincideReembolsar = ruta.match(
    /^\/v2\/payments\/captures\/([^/]+)\/refund$/,
  );
  if (metodo === "POST" && coincideReembolsar) {
    const capturaId = decodeURIComponent(coincideReembolsar[1]);
    paypalMock.reembolsos += 1;
    return responder(res, 201, { id: `REF-${capturaId}`, status: "COMPLETED" });
  }

  responder(res, 404, { name: "RESOURCE_NOT_FOUND" });
});

const servidorVision = http.createServer((req, res) => {
  if ((req.method ?? "GET") !== "POST") {
    res.writeHead(404);
    return res.end();
  }
  responder(res, 200, {
    responses: [
      {
        labelAnnotations: [],
        safeSearchAnnotation: { ...safeSearchMock },
      },
    ],
  });
});

const servidorMercadoPago = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  const ruta = url.pathname;

  if ((req.method ?? "GET") === "POST" && ruta === "/checkout/preferences") {
    const cuerpo = await leerCuerpo(req);
    mercadoPagoMock.preferencias.push(cuerpo);
    const id = `PREF-${++mercadoPagoMock.secuenciaPreferencias}`;
    return responder(res, 201, {
      id,
      init_point: `https://www.mercadopago.com.mx/checkout/v1/redirect?pref_id=${id}`,
    });
  }

  const coincidePago = ruta.match(/^\/v1\/payments\/([^/]+)$/);
  if ((req.method ?? "GET") === "GET" && coincidePago) {
    if (!mercadoPagoMock.pago) {
      return responder(res, 404, { message: "Pago no configurado en el mock" });
    }
    return responder(res, 200, {
      ...mercadoPagoMock.pago,
      id: decodeURIComponent(coincidePago[1]),
    });
  }

  const coincideReembolso = ruta.match(/^\/v1\/payments\/([^/]+)\/refunds$/);
  if ((req.method ?? "GET") === "POST" && coincideReembolso) {
    const pagoId = decodeURIComponent(coincideReembolso[1]);
    mercadoPagoMock.reembolsos.push(pagoId);
    return responder(res, 201, { id: `REFUND-${pagoId}`, status: "approved" });
  }

  responder(res, 404, { message: "Ruta no simulada" });
});

await new Promise<void>((ok) =>
  servidorPaypal.listen(PUERTO_MOCK_PAYPAL, "127.0.0.1", ok),
);
await new Promise<void>((ok) =>
  servidorVision.listen(PUERTO_MOCK_VISION, "127.0.0.1", ok),
);
await new Promise<void>((ok) =>
  servidorMercadoPago.listen(PUERTO_MOCK_MP, "127.0.0.1", ok),
);

function arrancarBackend(): ChildProcess {
  const env: NodeJS.ProcessEnv = { ...process.env, PORT: String(PUERTO_BACKEND) };
  const hijo = spawn(
    process.execPath,
    ["--harmony-temporal", "--import", "tsx", "src/server.ts"],
    { cwd: RAIZ, env, stdio: "pipe" },
  );
  hijo.stdout?.on("data", (d) => process.stdout.write(`[backend:${PUERTO_BACKEND}] ${d}`));
  hijo.stderr?.on("data", (d) =>
    process.stderr.write(`[backend:${PUERTO_BACKEND}:err] ${d}`),
  );
  return hijo;
}

async function esperarSalud(puerto: number): Promise<void> {
  for (let intento = 0; intento < 60; intento++) {
    try {
      const r = await fetch(`http://127.0.0.1:${puerto}/api/salud`);
      if (r.ok) return;
    } catch {
      /* aún no levanta */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`El backend en el puerto ${puerto} no arrancó`);
}

// ---------------------------------------------------------------------------
// Imágenes de prueba
// ---------------------------------------------------------------------------
const carpetaPruebas = path.join(RAIZ, "uploads", "pruebas-escrow");
fs.mkdirSync(carpetaPruebas, { recursive: true });
const rutaFotoProducto = path.join(carpetaPruebas, "producto.jpg");
const rutaComprobante = path.join(carpetaPruebas, "comprobante.png");

await sharp({
  create: {
    width: 600,
    height: 700,
    channels: 3,
    background: { r: 210, g: 225, b: 205 },
  },
})
  .jpeg()
  .toFile(rutaFotoProducto);
await sharp({
  create: {
    width: 600,
    height: 900,
    channels: 3,
    background: { r: 245, g: 245, b: 240 },
  },
})
  .png()
  .toFile(rutaComprobante);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
type Resultado = { nombre: string; ok: boolean; detalle: string };
const resultados: Resultado[] = [];

function verificar(nombre: string, ok: boolean, detalle = "") {
  resultados.push({ nombre, ok, detalle });
  console.log(`${ok ? "PASA " : "FALLA"} ${nombre}${ok ? "" : ` — ${detalle}`}`);
}

type ProductoCreado = {
  id: string;
  nombre: string;
  token: string;
  imagenes: string[];
};

const productosCreados: ProductoCreado[] = [];
const ventasCreadas = new Set<number>();
const pedidosCreados: string[] = [];

function registrarVenta(ventaId: unknown, pedido: string) {
  if (typeof ventaId === "number" && Number.isInteger(ventaId)) {
    ventasCreadas.add(ventaId);
  }
  if (pedido) pedidosCreados.push(pedido);
}

async function mensajeDe(r: Response): Promise<string> {
  try {
    const j = (await r.json()) as { message?: string };
    return j.message ?? JSON.stringify(j);
  } catch {
    return "(sin JSON)";
  }
}

function cuerpoProducto(cambios: Record<string, string> = {}): FormData {
  const base: Record<string, string> = {
    nombre: "Artículo de prueba escrow",
    precio: "250",
    descripcion:
      "Producto de prueba del ciclo de escrow con validaciones completas.",
    categoria: "Hogar",
    condicion: "usado-buen-estado",
    condicionUso: "usado-buen-estado",
    metodoEntrega: "punto-encuentro",
    horarioEntregaInicio: "09:00",
    horarioEntregaFin: "17:00",
    tiempoLimitePago: "60",
    ...cambios,
  };
  const fd = new FormData();
  for (const [campo, valor] of Object.entries(base)) {
    if (valor !== "__omitir__") fd.append(campo, valor);
  }
  return fd;
}

async function iniciarSesion(
  correo: string,
  password: string,
): Promise<string | null> {
  const r = await fetch(`${BASE}/api/usuarios/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ correo, password }),
  });
  const datos = (await r.json().catch(() => null)) as { token?: string } | null;
  return r.ok && datos?.token ? datos.token : null;
}

async function crearProducto(
  nombre: string,
  token: string,
  precio: number,
): Promise<ProductoCreado | null> {
  const fd = cuerpoProducto({ nombre, precio: String(precio) });
  fd.append(
    "imagenes",
    new Blob([fs.readFileSync(rutaFotoProducto)], { type: "image/jpeg" }),
    "producto.jpg",
  );
  const r = await fetch(`${BASE}/api/productos`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });
  if (!r.ok) {
    console.error(`No se pudo crear "${nombre}": ${r.status} ${await r.text()}`);
    return null;
  }
  const datos = (await r.json()) as { _id: string; imagenes?: string[] };
  const producto: ProductoCreado = {
    id: datos._id,
    nombre,
    token,
    imagenes: datos.imagenes ?? [],
  };
  productosCreados.push(producto);
  return producto;
}

async function entrarAFila(
  productoId: string,
  compradorId: string,
  correo: string,
): Promise<Response> {
  return fetch(`${BASE}/api/colas/entrar`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-comprador-id": compradorId,
    },
    body: JSON.stringify({ productoId, correo }),
  });
}

type ResultadoPago = {
  ok: boolean;
  detalle: string;
  orderId?: string;
  ventaId?: number;
  codigoPago?: string;
};

async function crearOrdenYAutorizar(
  productoId: string,
  compradorId: string,
): Promise<ResultadoPago> {
  const rOrden = await fetch(`${BASE}/api/pagos/crear-orden`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-comprador-id": compradorId,
    },
    body: JSON.stringify({ productoId }),
  });
  const orden = (await rOrden.json().catch(() => null)) as {
    orderId?: string;
  } | null;
  if (!rOrden.ok || !orden?.orderId) {
    return {
      ok: false,
      detalle: `crear orden: ${rOrden.status} ${JSON.stringify(orden)}`,
    };
  }

  const rCaptura = await fetch(
    `${BASE}/api/pagos/capturar-orden/${orden.orderId}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-comprador-id": compradorId,
      },
      body: JSON.stringify({}),
    },
  );
  const captura = (await rCaptura.json().catch(() => null)) as {
    ventaId?: number;
    codigoPago?: string;
  } | null;
  if (!rCaptura.ok || !captura?.codigoPago || typeof captura.ventaId !== "number") {
    return {
      ok: false,
      detalle: `autorizar: ${rCaptura.status} ${JSON.stringify(captura)}`,
    };
  }

  registrarVenta(captura.ventaId, orden.orderId);
  // Retención preventiva: el cron de cualquier backend que apunte a la misma
  // base no toca las ventas de la prueba mientras se preparan.
  await actualizarVenta(captura.ventaId, { retenido: true });

  return {
    ok: true,
    detalle: "",
    orderId: orden.orderId,
    ventaId: captura.ventaId,
    codigoPago: captura.codigoPago,
  };
}

async function pagarConPaypal(
  productoId: string,
  compradorId: string,
  correo: string,
): Promise<ResultadoPago> {
  const fila = await entrarAFila(productoId, compradorId, correo);
  if (!fila.ok) {
    return {
      ok: false,
      detalle: `entrar a la fila: ${fila.status} ${await mensajeDe(fila)}`,
    };
  }
  return crearOrdenYAutorizar(productoId, compradorId);
}

async function subirComprobanteDeVenta(
  ventaId: number,
  compradorId: string,
  datos: { palabraClave: string; referencia: string },
): Promise<{ status: number; cuerpo: any }> {
  const fd = new FormData();
  fd.append("palabraClave", datos.palabraClave);
  fd.append("referencia", datos.referencia);
  fd.append(
    "comprobante",
    new Blob([fs.readFileSync(rutaComprobante)], { type: "image/png" }),
    "comprobante.png",
  );
  const r = await fetch(`${BASE}/api/pagos/${ventaId}/comprobante`, {
    method: "POST",
    headers: { "x-comprador-id": compradorId },
    body: fd,
  });
  const cuerpo = await r.json().catch(() => null);
  return { status: r.status, cuerpo };
}

async function confirmarComprobante(ventaId: number, token: string) {
  const r = await fetch(`${BASE}/api/pagos/${ventaId}/confirmar-comprobante`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });
  return { status: r.status, cuerpo: await r.json().catch(() => null) };
}

async function rechazarComprobante(
  ventaId: number,
  token: string,
  motivo: string,
) {
  const r = await fetch(`${BASE}/api/pagos/${ventaId}/rechazar-comprobante`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ motivo }),
  });
  return { status: r.status, cuerpo: await r.json().catch(() => null) };
}

async function confirmarEntrega(
  ventaId: number,
  token: string,
  codigoEntrega: string,
) {
  const r = await fetch(`${BASE}/api/pagos/${ventaId}/confirmar-entrega`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ codigoEntrega }),
  });
  return { status: r.status, cuerpo: await r.json().catch(() => null) };
}

async function misCompras(compradorId: string): Promise<any[]> {
  const r = await fetch(`${BASE}/api/pagos/mis-compras`, {
    headers: { "x-comprador-id": compradorId },
  });
  const datos = (await r.json().catch(() => null)) as { compras?: any[] } | null;
  return datos?.compras ?? [];
}

async function enviarMensajeComprador(
  ventaMongoId: string,
  compradorId: string,
  contenido: string,
) {
  const r = await fetch(`${BASE}/api/mensajes/comprador/${ventaMongoId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-comprador-id": compradorId,
    },
    body: JSON.stringify({ contenido }),
  });
  return { status: r.status, cuerpo: await r.json().catch(() => null) };
}

async function enviarMensajeVendedor(
  ventaMongoId: string,
  token: string,
  contenido: string,
) {
  const r = await fetch(`${BASE}/api/mensajes/vendedor/${ventaMongoId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ contenido }),
  });
  return { status: r.status, cuerpo: await r.json().catch(() => null) };
}

async function calificar(
  ventaMongoId: string,
  opciones: { compradorId?: string; token?: string },
  quienCalifica: "comprador" | "vendedor",
  puntuacion: number,
) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opciones.token) headers.Authorization = `Bearer ${opciones.token}`;
  if (opciones.compradorId) headers["x-comprador-id"] = opciones.compradorId;
  const r = await fetch(`${BASE}/api/pagos/${ventaMongoId}/calificar`, {
    method: "POST",
    headers,
    body: JSON.stringify({ quienCalifica, puntuacion }),
  });
  return { status: r.status, cuerpo: await r.json().catch(() => null) };
}

// --- Acceso directo a PostgreSQL/MongoDB para verificar y simular plazos ----
async function leerVenta(ventaId: number): Promise<any> {
  return clientePrisma.venta.findUnique({ where: { id: ventaId } });
}

async function actualizarVenta(ventaId: number, datos: Record<string, unknown>) {
  return clientePrisma.venta.update({ where: { id: ventaId }, data: datos });
}

async function leerFila(productoId: string, compradorId: string): Promise<any> {
  return clientePrisma.cola.findFirst({ where: { productoId, compradorId } });
}

/**
 * Corre el job de cancelaciones rodeándolo de una protección: las ventas
 * ajenas a la prueba se marcan `retenido` durante la corrida (el job las
 * omite) y se restauran al terminar.
 */
async function ejecutarRevisor(): Promise<string[]> {
  const todas = (await clientePrisma.venta.findMany({ where: {} })) as any[];
  const ajenas = todas.filter(
    (venta) =>
      !ventasCreadas.has(Number(venta.id)) &&
      !venta.retenido &&
      ["pendiente_comprobante", "pendiente_confirmacion", "en_entrega"].includes(
        String(venta.estado),
      ),
  );

  for (const venta of ajenas) {
    await actualizarVenta(Number(venta.id), { retenido: true });
  }

  try {
    return await revisarEntregasVencidas();
  } finally {
    for (const venta of ajenas) {
      await actualizarVenta(Number(venta.id), { retenido: false });
    }
  }
}

const COMPRADOR_A = "comprador-escrow-ana";
const COMPRADOR_B = "comprador-escrow-bruno";
const COMPRADOR_C = "comprador-escrow-carla";
const COMPRADOR_D = "comprador-escrow-diego";
const COMPRADOR_E = "comprador-escrow-elena";
const COMPRADOR_F = "comprador-escrow-fabio";
const COMPRADOR_G = "comprador-escrow-gloria";
const COMPRADOR_H = "comprador-escrow-hugo";
const COMPRADOR_I = "comprador-escrow-iris";
const COMPRADOR_J = "comprador-escrow-julio";
const COMPRADOR_K = "comprador-escrow-karla";
const COMPRADOR_L = "comprador-escrow-laura";

const HORA = 60 * 60 * 1000;
const DIA = 24 * HORA;

// RQNF15: la fila solo se abre dentro del bloque de atención del vendedor.
// Los vendedores demo nacen en la semilla con 09:00-18:00; durante la suite
// se les abre la ventana máxima permitida y se restauran al terminar.
const CORREOS_DEMO = ["vendedor.demo@ichiba.test", "vendedor.mp@ichiba.test"];

const HORARIOS_SIEMPRE = [
  "lunes",
  "martes",
  "miercoles",
  "jueves",
  "viernes",
  "sabado",
  "domingo",
].map((dia) => ({
  dia,
  activo: true,
  horaInicio: "00:00",
  horaFin: "23:59",
}));

const HORARIOS_SEMILLA = HORARIOS_SIEMPRE.map((bloque) => ({
  ...bloque,
  horaInicio: "09:00",
  horaFin: "18:00",
}));

async function fijarHorariosDemo(
  horarios: typeof HORARIOS_SIEMPRE,
): Promise<void> {
  await clientePrisma.usuario.updateMany({
    where: { correo: { in: CORREOS_DEMO } },
    data: { horarios },
  });
  await Usuario.updateMany(
    { correo: { $in: CORREOS_DEMO } },
    { $set: { horarios } },
  );
}

// ---------------------------------------------------------------------------
// Pruebas
// ---------------------------------------------------------------------------
const hijos: ChildProcess[] = [];
try {
  console.log("Arrancando el backend de prueba…");
  const backend = arrancarBackend();
  hijos.push(backend);
  await esperarSalud(PUERTO_BACKEND);

  await mongoose.connect(process.env.MONGO_URI as string);

  // RQNF15: con los vendedores demo en horario abierto, la fila acepta
  // compradores a cualquier hora de la corrida.
  await fijarHorariosDemo(HORARIOS_SIEMPRE);

  const tokenVendedor = await iniciarSesion(
    "vendedor.demo@ichiba.test",
    "IchibaDemo123!",
  );
  verificar(
    "Cuenta demo del vendedor PayPal disponible (vendedor.demo@ichiba.test)",
    !!tokenVendedor,
    "no se pudo iniciar sesión; corre npm run seed",
  );
  const tokenMP = await iniciarSesion(
    "vendedor.mp@ichiba.test",
    "IchibaMP123!",
  );
  verificar(
    "Cuenta demo del vendedor MercadoPago disponible (vendedor.mp@ichiba.test)",
    !!tokenMP,
    "no se pudo iniciar sesión; corre npm run seed:mp",
  );

  const p1 = tokenVendedor
    ? await crearProducto("Bicicleta urbana de prueba", tokenVendedor, 250)
    : null;
  const p2 = tokenVendedor
    ? await crearProducto("Radio antigua de madera", tokenVendedor, 300)
    : null;
  const p3 = tokenVendedor
    ? await crearProducto("Cámara fotográfica clásica", tokenVendedor, 150)
    : null;
  const p4 = tokenVendedor
    ? await crearProducto("Reloj de pared artesanal", tokenVendedor, 170)
    : null;
  const p5 = tokenVendedor
    ? await crearProducto("Mochila tejida de palma", tokenVendedor, 190)
    : null;
  const p6 = tokenVendedor
    ? await crearProducto("Juego de té de porcelana", tokenVendedor, 210)
    : null;
  const p7 = tokenVendedor
    ? await crearProducto("Lámpara de escritorio antigua", tokenVendedor, 230)
    : null;
  const p8 = tokenVendedor
    ? await crearProducto("Cafetera manual de viaje", tokenVendedor, 270)
    : null;
  const pmp1 = tokenMP
    ? await crearProducto("Guitarra acústica restaurada", tokenMP, 321)
    : null;
  const pmp2 = tokenMP
    ? await crearProducto("Mesa plegable de camping", tokenMP, 450)
    : null;

  verificar(
    "Productos de prueba creados con la moderación simulada",
    [p1, p2, p3, p4, p5, p6, p7, p8, pmp1, pmp2].every(Boolean),
    `${productosCreados.length} de 10 productos`,
  );

  // -------------------------------------------------------------------------
  // Suite 1: compra con PayPal y ciclo completo del escrow (RQNF4 / RQNF20 /
  // RQNF24 / RQNF27 / RQNF28 / RQF22 / RQF26 / RQF31 / RQF33).
  // -------------------------------------------------------------------------
  if (p1 && tokenVendedor) {
    const fila = await entrarAFila(p1.id, COMPRADOR_A, "ana.compradora@ejemplo.test");
    verificar(
      "RQNF24.1 el comprador entra a la fila dejando su correo",
      fila.status === 201,
      `status ${fila.status}: ${await mensajeDe(fila)}`,
    );

    const rOrden = await fetch(`${BASE}/api/pagos/crear-orden`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-comprador-id": COMPRADOR_A,
      },
      body: JSON.stringify({ productoId: p1.id }),
    });
    const orden = (await rOrden.json().catch(() => null)) as any;
    verificar(
      "RQNF24.1 antes de pagar se advierte el bloque de atención del vendedor",
      rOrden.ok &&
        typeof orden?.avisoAtencion === "string" &&
        orden.avisoAtencion.length > 0,
      `status ${rOrden.status}: ${JSON.stringify(orden).slice(0, 300)}`,
    );
    verificar(
      "RQNF4 la orden de PayPal se crea con captura diferida (AUTHORIZE) y con el payee del vendedor",
      paypalMock.intents.at(-1) === "AUTHORIZE" &&
        paypalMock.payees.at(-1) === "vendedor.demo@example.com",
      `intent=${paypalMock.intents.at(-1)} payee=${paypalMock.payees.at(-1)}`,
    );

    const rCaptura = await fetch(
      `${BASE}/api/pagos/capturar-orden/${orden?.orderId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-comprador-id": COMPRADOR_A,
        },
        body: JSON.stringify({}),
      },
    );
    const captura = (await rCaptura.json().catch(() => null)) as any;
    registrarVenta(captura?.ventaId, String(orden?.orderId ?? ""));
    const venta1 = Number(captura?.ventaId ?? 0);

    verificar(
      "RQNF4/RQNF20 autorizar el pago crea la venta en pendiente_comprobante con su palabra clave de 4 dígitos",
      rCaptura.ok &&
        captura?.estado === "pendiente_comprobante" &&
        /^\d{4}$/.test(String(captura?.codigoPago ?? "")) &&
        Number.isInteger(venta1) &&
        venta1 > 0,
      `status ${rCaptura.status}: ${JSON.stringify(captura)}`,
    );

    if (venta1 > 0) {
      await actualizarVenta(venta1, { retenido: true });
      const filaPg = await leerVenta(venta1);
      verificar(
        "RQNF4 la venta guarda la autorización de PayPal (dinero retenido)",
        filaPg?.autorizacionPaypalId === `AUTH-${orden?.orderId}`,
        `autorizacionPaypalId=${filaPg?.autorizacionPaypalId}`,
      );

      // La idempotencia se mide sobre la SEGUNDA llamada: la primera
      // autorización (aquí arriba) es legítima; la recarga no debe sumar otra.
      const autorizacionesAntes = paypalMock.autorizacionesRegistradas;
      const rCaptura2 = await fetch(
        `${BASE}/api/pagos/capturar-orden/${orden?.orderId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-comprador-id": COMPRADOR_A,
          },
          body: JSON.stringify({}),
        },
      );
      const captura2 = (await rCaptura2.json().catch(() => null)) as any;
      verificar(
        "RQNF4 recargar la página de vuelta no reautoriza el pago (idempotente)",
        rCaptura2.ok &&
          captura2?.codigoPago === captura?.codigoPago &&
          paypalMock.autorizacionesRegistradas === autorizacionesAntes,
        `autorizaciones=${paypalMock.autorizacionesRegistradas - autorizacionesAntes}`,
      );

      let compraA = (await misCompras(COMPRADOR_A)).find(
        (compra) => compra.ventaId === venta1,
      );
      verificar(
        "El comprador ve su compra autorizada en mis-compras (sin código de entrega y con chat bloqueado)",
        compraA?.estado === "pendiente_comprobante" &&
          compraA?.codigoPago === captura?.codigoPago &&
          compraA?.codigoEntrega === null &&
          compraA?.chatHabilitado === false,
        JSON.stringify(compraA).slice(0, 300),
      );

      // --- Comprobante de pago (RQF22 / RQNF18) ---
      const distinta = captura?.codigoPago === "1234" ? "5678" : "1234";
      let intento = await subirComprobanteDeVenta(venta1, COMPRADOR_A, {
        palabraClave: distinta,
        referencia: "REF-000001",
      });
      verificar(
        "RQF22/RQNF20 una palabra clave distinta no pasa",
        intento.status === 400 &&
          String(intento.cuerpo?.message ?? "").includes("palabra clave"),
        `status ${intento.status}: ${JSON.stringify(intento.cuerpo)}`,
      );

      intento = await subirComprobanteDeVenta(venta1, COMPRADOR_A, {
        palabraClave: String(captura?.codigoPago),
        referencia: "ab",
      });
      verificar(
        "RQF22 la referencia del comprobante debe tener entre 4 y 64 caracteres",
        intento.status === 400,
        `status ${intento.status}: ${JSON.stringify(intento.cuerpo)}`,
      );

      safeSearchMock.adult = "VERY_LIKELY";
      intento = await subirComprobanteDeVenta(venta1, COMPRADOR_A, {
        palabraClave: String(captura?.codigoPago),
        referencia: "REF-000001",
      });
      safeSearchMock.adult = "VERY_UNLIKELY";
      const trasModeracion = await leerVenta(venta1);
      verificar(
        "RQNF18 la moderación bloquea un comprobante inapropiado antes de mostrarlo",
        intento.status === 400 &&
          String(intento.cuerpo?.message ?? "").includes("inapropiado") &&
          trasModeracion?.estado === "pendiente_comprobante",
        `status ${intento.status}: ${JSON.stringify(intento.cuerpo)}`,
      );

      intento = await subirComprobanteDeVenta(venta1, COMPRADOR_A, {
        palabraClave: String(captura?.codigoPago),
        referencia: "REF-000001",
      });
      verificar(
        "RQF22 con el comprobante válido la venta pasa a pendiente_confirmacion con plazo del vendedor",
        intento.status === 200 &&
          intento.cuerpo?.estado === "pendiente_confirmacion" &&
          !!intento.cuerpo?.confirmacionLimite,
        `status ${intento.status}: ${JSON.stringify(intento.cuerpo)}`,
      );

      const filaEnReposo = await leerFila(p1.id, COMPRADOR_A);
      verificar(
        "RQNF24.4 mientras el vendedor revisa, la fila del comprador queda en reposo",
        filaEnReposo?.estado === "reposo",
        `estado de la fila=${filaEnReposo?.estado}`,
      );

      compraA = (await misCompras(COMPRADOR_A)).find(
        (compra) => compra.ventaId === venta1,
      );
      const ventaMongoId = compraA?.ventaMongoId as string | null;
      verificar(
        "El espejo de la venta existe en MongoDB (chat y calificación)",
        typeof ventaMongoId === "string" && ventaMongoId.length > 0,
        `ventaMongoId=${ventaMongoId}`,
      );

      if (ventaMongoId) {
        const bloqueado = await enviarMensajeComprador(
          ventaMongoId,
          COMPRADOR_A,
          "Hola, ya envié mi comprobante",
        );
        verificar(
          "RQNF24.2 el chat sigue bloqueado hasta que el vendedor confirme el comprobante",
          bloqueado.status === 403 &&
            String(bloqueado.cuerpo?.message ?? "").includes("bloqueado"),
          `status ${bloqueado.status}: ${JSON.stringify(bloqueado.cuerpo)}`,
        );

        const calificacionTemprana = await calificar(
          ventaMongoId,
          { compradorId: COMPRADOR_A },
          "comprador",
          5,
        );
        verificar(
          "RQF27 no se puede calificar antes de la entrega confirmada",
          calificacionTemprana.status === 400,
          `status ${calificacionTemprana.status}: ${JSON.stringify(calificacionTemprana.cuerpo)}`,
        );
      }

      // --- Panel del vendedor (RQF30) ---
      const rPanel = await fetch(`${BASE}/api/pagos/vendedor/ventas`, {
        headers: { Authorization: `Bearer ${tokenVendedor}` },
      });
      const panel = (await rPanel.json().catch(() => null)) as any;
      const ventaEnPanel = (panel?.ventas ?? []).find(
        (venta: any) => venta.ventaId === venta1,
      );
      verificar(
        "RQF30/RQF31 el panel del vendedor lista la venta por revisar con su comprobante",
        rPanel.ok &&
          (panel?.resumen?.porRevisar ?? 0) >= 1 &&
          !!ventaEnPanel?.comprobante?.imagen,
        `status ${rPanel.status}: ${JSON.stringify(ventaEnPanel).slice(0, 300)}`,
      );

      const rImagenVendedor = await fetch(
        `${BASE}${ventaEnPanel?.comprobante?.imagen}`,
        { headers: { Authorization: `Bearer ${tokenVendedor}` } },
      );
      verificar(
        "RQF22 la imagen del comprobante solo la ven las partes: el vendedor sí",
        rImagenVendedor.status === 200 &&
          (rImagenVendedor.headers.get("content-type") ?? "").startsWith("image/"),
        `status ${rImagenVendedor.status}`,
      );
      const rImagenAjena = await fetch(
        `${BASE}/api/pagos/comprobante/${venta1}/imagen`,
        { headers: { "x-comprador-id": COMPRADOR_B } },
      );
      verificar(
        "RQF22 la imagen del comprobante solo la ven las partes: un tercero no",
        rImagenAjena.status === 403,
        `status ${rImagenAjena.status}`,
      );

      const rDetalleComprador = await fetch(
        `${BASE}/api/pagos/${venta1}/detalle`,
        { headers: { "x-comprador-id": COMPRADOR_A } },
      );
      const detalleComprador = (await rDetalleComprador.json().catch(() => null)) as any;
      const rDetalleVendedor = await fetch(
        `${BASE}/api/pagos/${venta1}/detalle`,
        { headers: { Authorization: `Bearer ${tokenVendedor}` } },
      );
      const detalleVendedor = (await rDetalleVendedor.json().catch(() => null)) as any;
      verificar(
        "RQNF20/RQNF24.4 el comprador ve su palabra clave; el vendedor no ve ningún código",
        detalleComprador?.rol === "comprador" &&
          detalleComprador?.codigoPago === captura?.codigoPago &&
          detalleComprador?.codigoEntrega === null &&
          detalleVendedor?.rol === "vendedor" &&
          detalleVendedor?.codigoPago === null &&
          detalleVendedor?.codigoEntrega === null,
        `comprador=${JSON.stringify({
          codigoPago: detalleComprador?.codigoPago,
          codigoEntrega: detalleComprador?.codigoEntrega,
        })} vendedor=${JSON.stringify({
          codigoPago: detalleVendedor?.codigoPago,
          codigoEntrega: detalleVendedor?.codigoEntrega,
        })}`,
      );
      const rDetalleTercero = await fetch(
        `${BASE}/api/pagos/${venta1}/detalle`,
        { headers: { "x-comprador-id": COMPRADOR_B } },
      );
      verificar(
        "El detalle de la compra está restringido a sus partes",
        rDetalleTercero.status === 403,
        `status ${rDetalleTercero.status}`,
      );

      // --- Confirmación del comprobante y entrega (RQF31/RQF26/RQF33) ---
      const confirmacion = await confirmarComprobante(venta1, tokenVendedor);
      verificar(
        "RQF31 confirmar el comprobante abre la etapa de entrega con su plazo",
        confirmacion.status === 200 &&
          confirmacion.cuerpo?.estado === "en_entrega" &&
          !!confirmacion.cuerpo?.entregaLimite,
        `${confirmacion.status}: ${JSON.stringify(confirmacion.cuerpo)}`,
      );

      const ventaEnEntrega = await leerVenta(venta1);
      verificar(
        "RQNF28 el plazo de entrega es de 15 días",
        !!ventaEnEntrega?.entregaLimite &&
          new Date(ventaEnEntrega.entregaLimite).getTime() >
            Date.now() + 14 * DIA,
        `entregaLimite=${ventaEnEntrega?.entregaLimite}`,
      );

      compraA = (await misCompras(COMPRADOR_A)).find(
        (compra) => compra.ventaId === venta1,
      );
      verificar(
        "RQNF24.4/RQNF29 el comprador recibe su código de entrega y el chat queda habilitado",
        compraA?.estado === "en_entrega" &&
          /^\d{4}$/.test(String(compraA?.codigoEntrega ?? "")) &&
          compraA?.chatHabilitado === true,
        JSON.stringify(compraA).slice(0, 300),
      );

      if (ventaMongoId) {
        const mensajeComprador = await enviarMensajeComprador(
          ventaMongoId,
          COMPRADOR_A,
          "¿Nos vemos mañana a las 10 en el punto acordado?",
        );
        const mensajeVendedor = await enviarMensajeVendedor(
          ventaMongoId,
          tokenVendedor,
          "Perfecto, ahí estaré con el producto",
        );
        const ventaTrasChat = await leerVenta(venta1);
        verificar(
          "RQNF29/RQNF30 con el pago confirmado, ambas partes escriben en el chat",
          mensajeComprador.status === 201 && mensajeVendedor.status === 201,
          `comprador=${mensajeComprador.status} vendedor=${mensajeVendedor.status}`,
        );
        verificar(
          "RQNF31 la actividad del chat queda registrada para el plazo de inactividad",
          !!ventaTrasChat?.ultimoMensajeEn,
          `ultimoMensajeEn=${ventaTrasChat?.ultimoMensajeEn}`,
        );
      }

      // Fase 7b: la venta nace retenida para protegerla de los crons de
      // desarrollo; se libera aquí porque el flujo real no retiene ventas
      // sanas y `confirmar-entrega` exige `retenido = false` (RQNF32).
      await actualizarVenta(venta1, { retenido: false });

      const entregaMala = await confirmarEntrega(venta1, tokenVendedor, "0000");
      const ventaTrasMala = await leerVenta(venta1);
      verificar(
        "RQF33 un código de entrega incorrecto no completa la compra",
        entregaMala.status === 400 && ventaTrasMala?.estado === "en_entrega",
        `status ${entregaMala.status}: ${JSON.stringify(entregaMala.cuerpo)}`,
      );

      const entregaBuena = await confirmarEntrega(
        venta1,
        tokenVendedor,
        String(compraA?.codigoEntrega),
      );
      verificar(
        "RQF26/RQNF27 registrar el código de entrega completa la venta y libera el dinero",
        entregaBuena.status === 200 &&
          entregaBuena.cuerpo?.estado === "completada",
        `${entregaBuena.status}: ${JSON.stringify(entregaBuena.cuerpo)}`,
      );

      const ventaCompletada = await leerVenta(venta1);
      verificar(
        "RQNF27 PayPal captura la autorización al completar (captura registrada)",
        paypalMock.capturas.get(`AUTH-${orden?.orderId}`) ===
          ventaCompletada?.capturaPaypalId,
        `captura en la venta=${ventaCompletada?.capturaPaypalId}`,
      );

      const espejo = await Venta.findOne({ paypalOrderId: orden?.orderId });
      verificar(
        "El espejo de MongoDB refleja la venta completada",
        espejo?.estado === "completada",
        `estado del espejo=${espejo?.estado}`,
      );

      const filaFinalizada = await leerFila(p1.id, COMPRADOR_A);
      verificar(
        "RQNF17 la fila del comprador se cierra al concluir la venta",
        filaFinalizada?.estado === "finalizada",
        `estado de la fila=${filaFinalizada?.estado}`,
      );

      if (ventaMongoId) {
        const chatCerrado = await enviarMensajeComprador(
          ventaMongoId,
          COMPRADOR_A,
          "¿Sigues ahí?",
        );
        verificar(
          "RQNF26 el chat se deshabilita al concluir la transacción",
          chatCerrado.status === 403 &&
            String(chatCerrado.cuerpo?.message ?? "").includes("concluyó"),
          `status ${chatCerrado.status}: ${JSON.stringify(chatCerrado.cuerpo)}`,
        );

        const calificacionComprador = await calificar(
          ventaMongoId,
          { compradorId: COMPRADOR_A },
          "comprador",
          5,
        );
        const calificacionVendedor = await calificar(
          ventaMongoId,
          { token: tokenVendedor },
          "vendedor",
          4,
        );
        const calificacionRepetida = await calificar(
          ventaMongoId,
          { compradorId: COMPRADOR_A },
          "comprador",
          3,
        );
        verificar(
          "RQF27 comprador y vendedor califican después de la entrega (sin repetir)",
          calificacionComprador.status === 200 &&
            calificacionVendedor.status === 200 &&
            calificacionRepetida.status === 400,
          `comprador=${calificacionComprador.status} vendedor=${calificacionVendedor.status} repetida=${calificacionRepetida.status}`,
        );
      }
    }
  }

  // -------------------------------------------------------------------------
  // Suite 2: rechazo del comprobante (RQNF23/23.2/24.2): se reembolsa y el
  // siguiente de la fila toma el turno.
  // -------------------------------------------------------------------------
  if (p2 && tokenVendedor) {
    await entrarAFila(p2.id, COMPRADOR_C, "carla.compradora@ejemplo.test");
    const filaD = await entrarAFila(
      p2.id,
      COMPRADOR_D,
      "diego.comprador@ejemplo.test",
    );
    verificar(
      "Fila de dos compradores preparada para la prueba de rechazo",
      filaD.status === 201,
      `status ${filaD.status}: ${await mensajeDe(filaD)}`,
    );

    const compraC = await crearOrdenYAutorizar(p2.id, COMPRADOR_C);
    if (!compraC.ok || !compraC.ventaId) {
      verificar(
        "RQNF23 el rechazo del comprobante reembolsa al comprador",
        false,
        compraC.detalle,
      );
    } else {
      const comprobanteC = await subirComprobanteDeVenta(
        compraC.ventaId,
        COMPRADOR_C,
        {
          palabraClave: String(compraC.codigoPago),
          referencia: "REF-REJA-01",
        },
      );
      verificar(
        "Comprobante recibido antes del rechazo",
        comprobanteC.status === 200,
        `status ${comprobanteC.status}: ${JSON.stringify(comprobanteC.cuerpo)}`,
      );

      const ajeno = await subirComprobanteDeVenta(
        compraC.ventaId,
        COMPRADOR_D,
        {
          palabraClave: String(compraC.codigoPago),
          referencia: "REF-AJENA-1",
        },
      );
      verificar(
        "RQF22 nadie puede registrar el comprobante de una compra ajena",
        ajeno.status === 403,
        `status ${ajeno.status}: ${JSON.stringify(ajeno.cuerpo)}`,
      );

      const anulacionesAntes = paypalMock.anulaciones.size;
      await actualizarVenta(compraC.ventaId, { retenido: false });
      const rechazo = await rechazarComprobante(
        compraC.ventaId,
        tokenVendedor,
        "El comprobante no coincide con el pago recibido",
      );
      const ventaRechazada = await leerVenta(compraC.ventaId);
      verificar(
        "RQNF23 rechazar el comprobante cancela la compra y devuelve el dinero (autorización anulada)",
        rechazo.status === 200 &&
          rechazo.cuerpo?.estado === "cancelada" &&
          ventaRechazada?.estado === "cancelada" &&
          paypalMock.anulaciones.size === anulacionesAntes + 1,
        `status=${rechazo.status} anulaciones nuevas=${paypalMock.anulaciones.size - anulacionesAntes}`,
      );
      verificar(
        "RQNF23 la cancelación registra el motivo del rechazo",
        String(ventaRechazada?.canceladoMotivo ?? "").includes("rechazado"),
        `motivo=${ventaRechazada?.canceladoMotivo}`,
      );

      const filaC = await leerFila(p2.id, COMPRADOR_C);
      const filaDPost = await leerFila(p2.id, COMPRADOR_D);
      const productoP2 = await Producto.findById(p2.id);
      verificar(
        "RQNF23.2/RQNF24.2 el siguiente de la fila toma el turno y el producto vuelve al catálogo",
        filaC?.estado === "finalizada" &&
          filaDPost?.estado === "activa" &&
          Number(filaDPost?.posicion) === 1 &&
          productoP2?.activo === true,
        `C=${filaC?.estado} D=${filaDPost?.estado}/${filaDPost?.posicion} activo=${productoP2?.activo}`,
      );

      const confirmarTarde = await confirmarComprobante(
        compraC.ventaId,
        tokenVendedor,
      );
      verificar(
        "RQF31 una compra ya cancelada no se puede confirmar",
        confirmarTarde.status === 400,
        `status ${confirmarTarde.status}: ${JSON.stringify(confirmarTarde.cuerpo)}`,
      );

      const compraCLista = (await misCompras(COMPRADOR_C)).find(
        (compra) => compra.ventaId === compraC.ventaId,
      );
      verificar(
        "RQNF26 la compra rechazada muestra su reembolso y sin chat",
        compraCLista?.estado === "cancelada" &&
          compraCLista?.chatHabilitado === false,
        JSON.stringify(compraCLista).slice(0, 300),
      );

      // RQNF20: la nueva sesión de pago del mismo producto genera otra clave.
      const compraD = await crearOrdenYAutorizar(p2.id, COMPRADOR_D);
      verificar(
        "RQNF20 la nueva sesión de pago de la misma fila genera otra palabra clave",
        compraD.ok && compraD.codigoPago !== compraC.codigoPago,
        `antes=${compraC.codigoPago} ahora=${compraD.codigoPago} (${compraD.detalle})`,
      );
    }
  } else if (tokenVendedor) {
    verificar(
      "RQNF23 el rechazo del comprobante reembolsa al comprador",
      false,
      "no se pudo crear el producto de la suite",
    );
  }

  // -------------------------------------------------------------------------
  // Suite 3: cancelaciones automáticas del job (RQNF23 / RQNF24 / RQNF28 /
  // RQNF31 / RQNF32).
  // -------------------------------------------------------------------------
  if (p3) {
    const compra = await pagarConPaypal(
      p3.id,
      COMPRADOR_E,
      "elena.compradora@ejemplo.test",
    );
    if (!compra.ok || !compra.ventaId) {
      verificar(
        "RQNF23 el comprobante sin subir en 24 h se cancela y reembolsa",
        false,
        compra.detalle,
      );
    } else {
      await actualizarVenta(compra.ventaId, {
        createdAt: new Date(Date.now() - 25 * HORA),
        retenido: false,
      });
      const acciones = await ejecutarRevisor();
      const venta = await leerVenta(compra.ventaId);
      const fila = await leerFila(p3.id, COMPRADOR_E);
      const producto = await Producto.findById(p3.id);
      verificar(
        "RQNF23 el comprobante sin subir en 24 h se cancela, reembolsa y libera la fila",
        venta?.estado === "cancelada" &&
          acciones.some((accion) => accion.includes(`Venta ${compra.ventaId}`)) &&
          fila?.estado === "finalizada" &&
          producto?.activo === true,
        `estado=${venta?.estado} fila=${fila?.estado} activo=${producto?.activo} acciones=${JSON.stringify(acciones)}`,
      );
      verificar(
        "RQNF23 la cancelación automática deja el motivo registrado",
        String(venta?.canceladoMotivo ?? "").includes("comprobante"),
        `motivo=${venta?.canceladoMotivo}`,
      );
      const adeudoP3 = await Adeudo.findOne({ ventaIdPg: compra.ventaId }).lean();
      verificar(
        "RQNF37 la cancelación por culpa del comprador (sin comprobante) NO genera adeudo del vendedor",
        adeudoP3 === null,
        `adeudo=${JSON.stringify(adeudoP3)}`,
      );
    }
  }

  if (p4 && tokenVendedor) {
    const compra = await pagarConPaypal(
      p4.id,
      COMPRADOR_F,
      "fabio.comprador@ejemplo.test",
    );
    if (!compra.ok || !compra.ventaId) {
      verificar(
        "RQNF24 el comprobante sin confirmar antes del fin del bloque se cancela y reembolsa",
        false,
        compra.detalle,
      );
    } else {
      await subirComprobanteDeVenta(compra.ventaId, COMPRADOR_F, {
        palabraClave: String(compra.codigoPago),
        referencia: "REF-F-0001",
      });
      await actualizarVenta(compra.ventaId, {
        confirmacionLimite: new Date(Date.now() - 60_000),
        retenido: false,
      });
      const acciones = await ejecutarRevisor();
      const venta = await leerVenta(compra.ventaId);
      verificar(
        "RQNF24 el comprobante sin confirmar antes del fin del bloque se cancela y reembolsa",
        venta?.estado === "cancelada" &&
          String(venta?.canceladoMotivo ?? "").includes("no confirmó") &&
          acciones.some((accion) => accion.includes(`Venta ${compra.ventaId}`)),
        `estado=${venta?.estado} motivo=${venta?.canceladoMotivo} acciones=${JSON.stringify(acciones)}`,
      );
      const adeudoP4 = await Adeudo.findOne({ ventaIdPg: compra.ventaId }).lean();
      verificar(
        "RQNF37 no confirmar el comprobante a tiempo genera adeudo del vendedor (causa sin_confirmar_comprobante)",
        adeudoP4?.causa === "sin_confirmar_comprobante" &&
          Number(adeudoP4?.monto) === 170 &&
          adeudoP4?.estado === "pendiente",
        `adeudo=${JSON.stringify(adeudoP4)}`,
      );
    }
  }

  if (p5 && tokenVendedor) {
    const compra = await pagarConPaypal(
      p5.id,
      COMPRADOR_G,
      "gloria.compradora@ejemplo.test",
    );
    if (!compra.ok || !compra.ventaId) {
      verificar(
        "RQNF28 la entrega fuera de los 15 días se cancela y reembolsa",
        false,
        compra.detalle,
      );
    } else {
      await subirComprobanteDeVenta(compra.ventaId, COMPRADOR_G, {
        palabraClave: String(compra.codigoPago),
        referencia: "REF-G-0001",
      });
      await confirmarComprobante(compra.ventaId, tokenVendedor);
      await actualizarVenta(compra.ventaId, {
        entregaLimite: new Date(Date.now() - 60_000),
        retenido: false,
      });
      const acciones = await ejecutarRevisor();
      const venta = await leerVenta(compra.ventaId);
      verificar(
        "RQNF28 la entrega fuera de los 15 días se cancela y reembolsa",
        venta?.estado === "cancelada" &&
          String(venta?.canceladoMotivo ?? "").includes("entrega") &&
          acciones.some((accion) => accion.includes(`Venta ${compra.ventaId}`)),
        `estado=${venta?.estado} motivo=${venta?.canceladoMotivo} acciones=${JSON.stringify(acciones)}`,
      );
      const adeudoP5 = await Adeudo.findOne({ ventaIdPg: compra.ventaId }).lean();
      const espejoVendedor = await Usuario.findOne({
        correo: "vendedor.demo@ichiba.test",
      }).lean();
      verificar(
        "RQNF37/RQNF38 la entrega vencida genera adeudo (causa entrega_vencida) y suspende al vendedor con saldo pendiente",
        adeudoP5?.causa === "entrega_vencida" &&
          Number(adeudoP5?.monto) === 190 &&
          espejoVendedor?.suspendido === true &&
          espejoVendedor?.motivoSuspension === "saldo_pendiente" &&
          Number(espejoVendedor?.saldoPendiente ?? 0) >= 190,
        `adeudo=${JSON.stringify(adeudoP5)} espejo=${JSON.stringify({
          suspendido: espejoVendedor?.suspendido,
          motivo: espejoVendedor?.motivoSuspension,
          saldo: espejoVendedor?.saldoPendiente,
        })}`,
      );
    }
  }

  if (p6 && tokenVendedor) {
    const compra = await pagarConPaypal(
      p6.id,
      COMPRADOR_H,
      "hugo.comprador@ejemplo.test",
    );
    if (!compra.ok || !compra.ventaId) {
      verificar(
        "RQNF31 tres bloques de atención sin mensajes cancelan y reembolsan",
        false,
        compra.detalle,
      );
    } else {
      await subirComprobanteDeVenta(compra.ventaId, COMPRADOR_H, {
        palabraClave: String(compra.codigoPago),
        referencia: "REF-H-0001",
      });
      await confirmarComprobante(compra.ventaId, tokenVendedor);

      const compraH = (await misCompras(COMPRADOR_H)).find(
        (candidata) => candidata.ventaId === compra.ventaId,
      );
      if (compraH?.ventaMongoId) {
        await enviarMensajeComprador(
          compraH.ventaMongoId,
          COMPRADOR_H,
          "¿Cuándo podríamos vernos para la entrega?",
        );
      }

      // Simula que pasaron 5 días sin ningún mensaje nuevo.
      await actualizarVenta(compra.ventaId, {
        ultimoMensajeEn: new Date(Date.now() - 5 * DIA),
        comprobanteConfirmadoEn: new Date(Date.now() - 5 * DIA),
        retenido: false,
      });
      const acciones = await ejecutarRevisor();
      const venta = await leerVenta(compra.ventaId);
      verificar(
        "RQNF31 tres bloques de atención sin mensajes cancelan y reembolsan",
        venta?.estado === "cancelada" &&
          String(venta?.canceladoMotivo ?? "").includes("Inactividad") &&
          acciones.some((accion) => accion.includes(`Venta ${compra.ventaId}`)),
        `estado=${venta?.estado} motivo=${venta?.canceladoMotivo} acciones=${JSON.stringify(acciones)}`,
      );
      const adeudoP6 = await Adeudo.findOne({ ventaIdPg: compra.ventaId }).lean();
      verificar(
        "RQNF37 la inactividad del chat genera adeudo del vendedor (causa inactividad_chat)",
        adeudoP6?.causa === "inactividad_chat" && Number(adeudoP6?.monto) === 210,
        `adeudo=${JSON.stringify(adeudoP6)}`,
      );
    }
  }

  if (p7) {
    const compra = await pagarConPaypal(
      p7.id,
      COMPRADOR_I,
      "iris.compradora@ejemplo.test",
    );
    if (!compra.ok || !compra.ventaId || !compra.orderId) {
      verificar(
        "RQNF32 si el reembolso automático falla, la venta queda retenida para el administrador",
        false,
        compra.detalle,
      );
    } else {
      paypalMock.fallarAnulacion.add(`AUTH-${compra.orderId}`);
      await actualizarVenta(compra.ventaId, {
        createdAt: new Date(Date.now() - 25 * HORA),
        retenido: false,
      });
      const acciones = await ejecutarRevisor();
      const venta = await leerVenta(compra.ventaId);
      const sinAccion = !acciones.some((accion) =>
        accion.includes(`Venta ${compra.ventaId}`),
      );
      paypalMock.fallarAnulacion.delete(`AUTH-${compra.orderId}`);

      await ejecutarRevisor();
      const ventaDespues = await leerVenta(compra.ventaId);
      verificar(
        "RQNF32 si el reembolso automático falla, la venta queda retenida para el administrador y el job no la reintenta",
        venta?.retenido === true &&
          venta?.estado === "pendiente_comprobante" &&
          String(venta?.canceladoMotivo ?? "").includes("revisión") &&
          sinAccion &&
          ventaDespues?.retenido === true &&
          ventaDespues?.estado === "pendiente_comprobante",
        `retenido=${venta?.retenido} estado=${venta?.estado} motivo=${venta?.canceladoMotivo} sinAccion=${sinAccion}`,
      );
    }
  }

  if (p8) {
    const compra = await pagarConPaypal(
      p8.id,
      COMPRADOR_J,
      "julio.comprador@ejemplo.test",
    );
    if (!compra.ok || !compra.ventaId) {
      verificar(
        "El revisor no toca las ventas dentro de sus plazos",
        false,
        compra.detalle,
      );
    } else {
      await actualizarVenta(compra.ventaId, { retenido: false });
      await ejecutarRevisor();
      const venta = await leerVenta(compra.ventaId);
      verificar(
        "El revisor no toca las ventas dentro de sus plazos",
        venta?.estado === "pendiente_comprobante" && !venta?.retenido,
        `estado=${venta?.estado} retenido=${venta?.retenido}`,
      );
    }
  }

  // -------------------------------------------------------------------------
  // Suite 4: MercadoPago (escrow interno): cobro, reembolso por su API y
  // entrega completa sin captura de PayPal (RQNF23 / RQNF27).
  // -------------------------------------------------------------------------
  if (pmp1 && tokenMP) {
    await entrarAFila(pmp1.id, COMPRADOR_K, "karla.compradora@ejemplo.test");
    const rOrden = await fetch(`${BASE}/api/pagos/crear-orden`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-comprador-id": COMPRADOR_K,
      },
      body: JSON.stringify({ productoId: pmp1.id }),
    });
    const orden = (await rOrden.json().catch(() => null)) as any;
    const preferencia = mercadoPagoMock.preferencias.at(-1);
    verificar(
      "MercadoPago: la preferencia lleva la referencia mp: y el comprador en metadatos",
      rOrden.ok &&
        orden?.metodo === "mercadopago" &&
        String(orden?.linkAprobacion ?? "").startsWith(
          "https://www.mercadopago.com.mx/",
        ) &&
        preferencia?.external_reference === `mp:${pmp1.id}` &&
        preferencia?.metadata?.compradorId === COMPRADOR_K,
      `status=${rOrden.status} preferencia=${JSON.stringify(preferencia).slice(0, 250)}`,
    );

    mercadoPagoMock.pago = {
      status: "approved",
      external_reference: `mp:${pmp1.id}`,
      transaction_amount: 321,
      metadata: { productoId: pmp1.id, compradorId: COMPRADOR_K },
    };
    const rConfirmar = await fetch(
      `${BASE}/api/pagos/confirmar-mercadopago`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-comprador-id": COMPRADOR_K,
        },
        body: JSON.stringify({ paymentId: "PAY-MP-1" }),
      },
    );
    const confirmado = (await rConfirmar.json().catch(() => null)) as any;
    registrarVenta(confirmado?.ventaId, "mp:PAY-MP-1");
    verificar(
      "MercadoPago: el pago aprobado registra la venta en el escrow con su palabra clave",
      rConfirmar.ok &&
        confirmado?.estado === "pendiente_comprobante" &&
        /^\d{4}$/.test(String(confirmado?.codigoPago ?? "")),
      `status ${rConfirmar.status}: ${JSON.stringify(confirmado)}`,
    );

    if (typeof confirmado?.ventaId === "number") {
      const ventaIdMP = confirmado.ventaId as number;
      await actualizarVenta(ventaIdMP, { retenido: true });
      await actualizarVenta(ventaIdMP, {
        createdAt: new Date(Date.now() - 25 * HORA),
        retenido: false,
      });
      const acciones = await ejecutarRevisor();
      const ventaMP = await leerVenta(ventaIdMP);
      verificar(
        "RQNF23 MercadoPago: la cancelación automática usa el reembolso de su API",
        ventaMP?.estado === "reembolsada" &&
          ventaMP?.reembolsoId === "REFUND-PAY-MP-1" &&
          mercadoPagoMock.reembolsos.includes("PAY-MP-1") &&
          acciones.some((accion) => accion.includes(`Venta ${ventaIdMP}`)),
        `estado=${ventaMP?.estado} reembolso=${ventaMP?.reembolsoId} acciones=${JSON.stringify(acciones)}`,
      );

      const compraK = (await misCompras(COMPRADOR_K)).find(
        (compra) => compra.ventaId === ventaIdMP,
      );
      verificar(
        "RQNF23 el comprador ve su compra reembolsada y su motivo",
        compraK?.estado === "reembolsada" &&
          String(compraK?.canceladoMotivo ?? "").includes("comprobante"),
        JSON.stringify(compraK).slice(0, 300),
      );
    }
  }

  if (pmp2 && tokenMP) {
    await entrarAFila(pmp2.id, COMPRADOR_L, "laura.compradora@ejemplo.test");
    const rOrden = await fetch(`${BASE}/api/pagos/crear-orden`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-comprador-id": COMPRADOR_L,
      },
      body: JSON.stringify({ productoId: pmp2.id }),
    });
    const orden = (await rOrden.json().catch(() => null)) as any;

    if (!rOrden.ok || !orden?.orderId) {
      // En MercadoPago la respuesta trae preferenceId, no orderId.
    }
    mercadoPagoMock.pago = {
      status: "approved",
      external_reference: `mp:${pmp2.id}`,
      transaction_amount: 450,
      metadata: { productoId: pmp2.id, compradorId: COMPRADOR_L },
    };
    const rConfirmar = await fetch(
      `${BASE}/api/pagos/confirmar-mercadopago`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-comprador-id": COMPRADOR_L,
        },
        body: JSON.stringify({ paymentId: "PAY-MP-2" }),
      },
    );
    const confirmado = (await rConfirmar.json().catch(() => null)) as any;
    registrarVenta(confirmado?.ventaId, "mp:PAY-MP-2");

    if (typeof confirmado?.ventaId !== "number") {
      verificar(
        "RQNF27 MercadoPago: el ciclo completo cierra sin captura de PayPal",
        false,
        `confirmar: ${rConfirmar.status} ${JSON.stringify(confirmado)}`,
      );
    } else {
      const ventaIdMP2 = confirmado.ventaId as number;
      await actualizarVenta(ventaIdMP2, { retenido: true });

      const comprobante = await subirComprobanteDeVenta(
        ventaIdMP2,
        COMPRADOR_L,
        {
          palabraClave: String(confirmado.codigoPago),
          referencia: "REF-MP-0002",
        },
      );
      const confirmacion = await confirmarComprobante(ventaIdMP2, tokenMP);
      const compraL = (await misCompras(COMPRADOR_L)).find(
        (compra) => compra.ventaId === ventaIdMP2,
      );
      // Igual que en la suite de PayPal: se libera la retención preventiva
      // antes de registrar la entrega (RQNF32).
      await actualizarVenta(ventaIdMP2, { retenido: false });
      const entrega = await confirmarEntrega(
        ventaIdMP2,
        tokenMP,
        String(compraL?.codigoEntrega ?? ""),
      );
      const ventaFinal = await leerVenta(ventaIdMP2);
      verificar(
        "RQNF27 MercadoPago: el ciclo completo cierra sin captura de PayPal (escrow interno)",
        comprobante.status === 200 &&
          confirmacion.cuerpo?.estado === "en_entrega" &&
          entrega.cuerpo?.estado === "completada" &&
          ventaFinal?.estado === "completada" &&
          (ventaFinal?.capturaPaypalId ?? null) === null,
        `comprobante=${comprobante.status} confirmado=${JSON.stringify(confirmacion.cuerpo)} entrega=${JSON.stringify(entrega.cuerpo)} captura=${ventaFinal?.capturaPaypalId}`,
      );
    }
  }
} finally {
  // -------------------------------------------------------------------------
  // Limpieza: archivos de comprobantes, filas y ventas de prueba en
  // PostgreSQL, espejos y productos en MongoDB, y todos los procesos/mocks.
  // -------------------------------------------------------------------------
  try {
    await fijarHorariosDemo(HORARIOS_SEMILLA);
  } catch (error) {
    console.error(
      "[limpieza] No se pudieron restaurar los horarios de los vendedores demo:",
      error,
    );
  }

  try {
    if (ventasCreadas.size > 0) {
      const ventas = (await clientePrisma.venta.findMany({ where: {} })) as any[];
      for (const venta of ventas) {
        if (!ventasCreadas.has(Number(venta.id))) continue;
        const imagen = String(venta.comprobanteImagen ?? "");
        if (imagen.startsWith("/uploads/comprobantes/")) {
          const ruta = path.join(RAIZ, imagen.replace(/^\//, ""));
          if (fs.existsSync(ruta)) fs.unlinkSync(ruta);
        }
      }
    }
  } catch (error) {
    console.error("[limpieza] No se pudieron borrar los comprobantes:", error);
  }

  try {
    for (const producto of productosCreados) {
      await clientePrisma.cola.deleteMany({ where: { productoId: producto.id } });
    }
    for (const ventaId of ventasCreadas) {
      await clientePrisma.venta.deleteMany({ where: { id: ventaId } });
    }
  } catch (error) {
    console.error("[limpieza] No se pudieron borrar filas/ventas de prueba:", error);
  }

  try {
    // Fase 7b (RQNF37/RQNF38): las cancelaciones por culpa del vendedor de
    // las ventas de prueba (y las de corridas anteriores que quedaron
    // huérfanas) se reflejan en adeudos y en la suspensión del espejo. Al
    // borrarse las ventas, se eliminan los adeudos huérfanos y se recalcula
    // el saldo para devolver a los vendedores demo su estado normal.
    const adeudos = await Adeudo.find({}).lean();
    const usuariosConSaldo = new Set<number>();
    let borrados = 0;
    for (const adeudo of adeudos) {
      const venta = await clientePrisma.venta.findUnique({
        where: { id: Number(adeudo.ventaIdPg) },
      });
      if (venta) continue;
      await Adeudo.deleteOne({ _id: adeudo._id });
      usuariosConSaldo.add(Number(adeudo.usuarioId));
      borrados += 1;
    }
    for (const usuarioId of usuariosConSaldo) {
      const pendientes = await Adeudo.find({
        usuarioId,
        estado: "pendiente",
      }).lean();
      const saldo = pendientes.reduce(
        (suma, adeudo) => suma + Number(adeudo.monto ?? 0),
        0,
      );
      const espejo = await Usuario.findOne({ usuarioId }).lean();
      const actualizacion: Record<string, unknown> = { saldoPendiente: saldo };
      if (
        saldo === 0 &&
        espejo?.suspendido === true &&
        String(espejo?.motivoSuspension ?? "") === "saldo_pendiente"
      ) {
        actualizacion.suspendido = false;
        actualizacion.motivoSuspension = null;
      }
      await Usuario.updateOne({ usuarioId }, { $set: actualizacion });
    }
    if (borrados > 0) {
      console.log(`[limpieza] Adeudos huérfanos de prueba eliminados: ${borrados}`);
    }
  } catch (error) {
    console.error("[limpieza] No se pudieron limpiar los adeudos de prueba:", error);
  }

  try {
    if (pedidosCreados.length > 0) {
      await Venta.deleteMany({ paypalOrderId: { $in: pedidosCreados } });
    }
  } catch (error) {
    console.error("[limpieza] No se pudieron borrar los espejos de Mongo:", error);
  }

  for (const producto of productosCreados) {
    try {
      const r = await fetch(`${BASE}/api/productos/${producto.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${producto.token}` },
      });
      if (!r.ok) throw new Error(`status ${r.status}`);
    } catch {
      try {
        await Producto.deleteOne({ _id: producto.id });
        for (const imagen of producto.imagenes) {
          const ruta = path.join(RAIZ, imagen.replace(/^\//, ""));
          if (fs.existsSync(ruta)) fs.unlinkSync(ruta);
        }
      } catch {
        /* ignorar */
      }
    }
  }

  for (const hijo of hijos) {
    try {
      hijo.kill();
    } catch {
      /* ignorar */
    }
  }
  for (const servidor of [servidorPaypal, servidorVision, servidorMercadoPago]) {
    try {
      servidor.close();
    } catch {
      /* ignorar */
    }
  }
  try {
    fs.rmSync(carpetaPruebas, { recursive: true, force: true });
  } catch {
    /* ignorar */
  }
  try {
    await mongoose.disconnect();
  } catch {
    /* ignorar */
  }
  try {
    const cerrar = (clientePrisma as { close?: () => Promise<void> }).close;
    if (typeof cerrar === "function") await cerrar();
  } catch {
    /* ignorar */
  }
}

// ---------------------------------------------------------------------------
const fallas = resultados.filter((resultado) => !resultado.ok);
console.log(
  `\nSuite de escrow: ${resultados.length - fallas.length}/${resultados.length} pruebas pasaron`,
);
if (fallas.length > 0) {
  console.log("Fallas:");
  for (const falla of fallas) console.log(` - ${falla.nombre}: ${falla.detalle}`);
  process.exit(1);
}
process.exit(0);
