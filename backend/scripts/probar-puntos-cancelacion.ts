/**
 * Pruebas E2E de RQNF10.1 a RQNF10.7 (puntos de reputación y cancelación
 * permanente de la cuenta), RQF10 (cancelación por acumular 8 puntos),
 * RQF11 (correo de cancelación con el motivo y los reportes que la
 * originaron), RQF12 (acceso restringido: solo entregas con pago confirmado)
 * y RQNF23/27 (los reembolsos siguen funcionando para una cuenta cancelada).
 *
 * Cubre:
 *  1. Los puntos solo se suman cuando el administrador CONFIRMA el reporte
 *     (1.5 faltas de trato directo, 1 leves generales, 3 graves) y un reporte
 *     rechazado no suma nada (RQNF10.1).
 *  2. Al llegar a 8 puntos: cuenta `cancelada`, correo de cancelación, alta
 *     inmediata en la lista negra (RFC/CURP/INE), publicaciones desactivadas,
 *     filas sin pago canceladas con aviso al cliente y acceso restringido a
 *     entregas (RQNF10.3 / RQNF10.5 / RQNF10.6 / RQNF10.7 / RQF11 / RQF12).
 *  3. El vendedor cancelado puede entrar y completar sus entregas con pago
 *     confirmado, pero no publicar, confirmar horario, cambiar preferencias
 *     ni calificar (RQF12).
 *  4. Al resolverse la última entrega se purga TODO (nombre, domicilio,
 *     teléfono, correo, contraseña, publicaciones, chats y token de PayPal);
 *     las ventas se conservan para los compradores (RQNF10.6).
 *  5. El trabajo periódico también purga cuentas canceladas sin pendientes.
 *
 * Levanta un backend de prueba en el puerto 5098 con mocks locales de PayPal
 * y Cloud Vision, y usa directamente PostgreSQL/MongoDB locales (mismos que
 * el backend de desarrollo).
 *
 * Uso (con MongoDB y PostgreSQL locales corriendo):
 *   node --harmony-temporal --import tsx scripts/probar-puntos-cancelacion.ts
 */
import "dotenv/config";
import { spawn, type ChildProcess } from "child_process";
import http from "http";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import sharp from "sharp";
import clientePrisma from "../src/configuracion/prisma.js";
import { Producto } from "../src/models/producto.js";
import { Venta } from "../src/models/Venta.js";
import { Mensaje } from "../src/models/Mensaje.js";
import { Usuario } from "../src/models/usuario.js";
import { ListaNegra } from "../src/models/ListaNegra.js";
import { Sancion } from "../src/models/Sancion.js";
import {
  EstadoVinculacionPayPal,
  VinculoPayPal,
} from "../src/models/VinculoPayPal.js";
import { revisarEntregasVencidas } from "../src/jobs/revisionEntregas.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(__dirname, "..");

const PUERTO_BACKEND = 5098;
const PUERTO_MOCK_PAYPAL = 59094;
const PUERTO_MOCK_VISION = 59095;
const BASE = `http://127.0.0.1:${PUERTO_BACKEND}`;

// --- Variables de los mocks: se fijan ANTES de que corran los servicios ----
process.env.PAYPAL_API_BASE = `http://127.0.0.1:${PUERTO_MOCK_PAYPAL}`;
process.env.PAYPAL_CLIENT_ID = "cliente-de-prueba";
process.env.PAYPAL_CLIENT_SECRET = "secreto-de-prueba";
process.env.GOOGLE_VISION_API_KEY = "clave-de-prueba";
process.env.GOOGLE_VISION_ENDPOINT = `http://127.0.0.1:${PUERTO_MOCK_VISION}/v1/images:annotate`;
// Correos a consola: las pruebas no envían correo real.
process.env.GMAIL_USER = "";
process.env.GMAIL_APP_PASSWORD = "";

const marca = String(Date.now()).slice(-8);
const CORREO_VENDEDOR = `vendedor.puntos.${marca}@ichiba.test`;
const PASSWORD_VENDEDOR = "PuntosIchiba123!";
const CORREO_ADMIN = `admin.puntos.${marca}@ichiba.test`;
const PASSWORD_ADMIN = "AdminPuntos123!";
const CORREO_PURGA = `vendedor.purga.${marca}@ichiba.test`;
const RFC_VENDEDOR = `PT${marca}ABC`;
const CURP_VENDEDOR = `PT${marca}HDFRRN01`;
const MRZ_VENDEDOR = `MRZPT${marca}PRUEBA`;
const RFC_PURGA = `PG${marca}XYZ`;
const CORREO_PAYPAL = `paypal.puntos.${marca}@ejemplo.test`;

const COMPRADOR_UNO = `comprador-puntos-uno-${marca}`;
const COMPRADOR_DOS = `comprador-puntos-dos-${marca}`;
const COMPRADOR_TRES = `comprador-puntos-tres-${marca}`;

const HORARIOS = [
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
  horaInicio: "09:00",
  horaFin: "18:00",
}));

// RQNF15: la fila solo se abre dentro del bloque de atención del vendedor;
// las cuentas de prueba se crean con la ventana máxima permitida para poder
// comprar a cualquier hora. `HORARIOS` (09:00-18:00) se conserva para la
// prueba de la cuenta cancelada que intenta confirmar horario.
const HORARIOS_SIEMPRE = HORARIOS.map((bloque) => ({
  ...bloque,
  horaInicio: "00:00",
  horaFin: "23:59",
}));

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
  ordenes: new Map<string, OrdenPaypalMock>(),
  capturas: new Map<string, string>(),
  anulaciones: new Set<string>(),
  reembolsos: 0,
};

const safeSearchMock = {
  adult: "VERY_UNLIKELY",
  spoof: "VERY_UNLIKELY",
  violence: "VERY_UNLIKELY",
  racy: "VERY_UNLIKELY",
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
    const unidad = cuerpo?.purchase_units?.[0] ?? {};

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
    return responder(res, 201, ordenPaypalComoRespuesta(orden));
  }

  const coincideConsultar = ruta.match(/^\/v2\/checkout\/orders\/([^/]+)$/);
  if (metodo === "GET" && coincideConsultar) {
    const orden = paypalMock.ordenes.get(decodeURIComponent(coincideConsultar[1]));
    if (!orden) return responder(res, 404, { name: "RESOURCE_NOT_FOUND" });
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

await new Promise<void>((ok) =>
  servidorPaypal.listen(PUERTO_MOCK_PAYPAL, "127.0.0.1", ok),
);
await new Promise<void>((ok) =>
  servidorVision.listen(PUERTO_MOCK_VISION, "127.0.0.1", ok),
);

function arrancarBackend(): ChildProcess {
  const env: NodeJS.ProcessEnv = { ...process.env, PORT: String(PUERTO_BACKEND) };
  const hijo = spawn(
    process.execPath,
    ["--harmony-temporal", "--import", "tsx", "src/server.ts"],
    { cwd: RAIZ, env, stdio: "pipe" },
  );
  hijo.stdout?.on("data", (d) =>
    process.stdout.write(`[backend:${PUERTO_BACKEND}] ${d}`),
  );
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
const carpetaPruebas = path.join(RAIZ, "uploads", "pruebas-puntos");
fs.mkdirSync(carpetaPruebas, { recursive: true });
const rutaFotoProducto = path.join(carpetaPruebas, "producto.jpg");
const rutaComprobante = path.join(carpetaPruebas, "comprobante.png");

await sharp({
  create: {
    width: 600,
    height: 700,
    channels: 3,
    background: { r: 205, g: 215, b: 230 },
  },
})
  .jpeg()
  .toFile(rutaFotoProducto);
await sharp({
  create: {
    width: 600,
    height: 900,
    channels: 3,
    background: { r: 240, g: 240, b: 235 },
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
const ventasMongoIds = new Set<string>();
const idsCuentas: number[] = [];
const correosCuentas: string[] = [];

function registrarVenta(ventaId: unknown, pedido: string, mongoId?: unknown) {
  if (typeof ventaId === "number" && Number.isInteger(ventaId)) {
    ventasCreadas.add(ventaId);
  }
  if (pedido) pedidosCreados.push(pedido);
  if (typeof mongoId === "string" && mongoId) ventasMongoIds.add(mongoId);
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
    nombre: "Artículo de prueba puntos",
    precio: "150",
    descripcion:
      "Producto de prueba del flujo de puntos de reputación y cancelación.",
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

async function crearReporte(
  compradorId: string,
  vendedorId: number,
  categoria: string,
) {
  const r = await fetch(`${BASE}/api/reportes`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-comprador-id": compradorId,
    },
    body: JSON.stringify({
      sujetoId: String(vendedorId),
      sujetoTipo: "usuario",
      elemento: "producto",
      categoria,
      detalle: "Reporte de prueba E2E de puntos de reputación",
    }),
  });
  return { status: r.status, cuerpo: await r.json().catch(() => null) };
}

async function buscarReporte(
  vendedorId: number,
  compradorId: string,
  categoria: string,
) {
  return clientePrisma.reporte.findFirst({
    where: {
      vendedorId,
      reportadoPorId: compradorId,
      categoria,
    },
  });
}

async function resolverReporte(
  idReporte: number,
  tokenAdmin: string,
  resultado: "confirmado" | "rechazado",
) {
  const r = await fetch(`${BASE}/api/admin/reportes/${idReporte}/resolver`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${tokenAdmin}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ resultado }),
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

/**
 * Crea una cuenta de prueba directamente en PostgreSQL y su espejo en
 * MongoDB (la autenticación lee el espejo, así que la contraseña va con
 * hash bcryptjs real).
 */
async function crearCuentaDePrueba(opciones: {
  correo: string;
  nombreCompleto: string;
  password: string;
  tipo: "vendedor" | "admin";
  rfc: string;
  curp?: string;
  ineCodigoReverso?: string;
  estadoCuenta?: string;
  canceladaEn?: Date | null;
}): Promise<number> {
  const passwordHasheada = await bcrypt.hash(opciones.password, 10);
  const horarioConfirmadoEn = new Date();

  const creado = await clientePrisma.usuario.create({
    data: {
      nombreCompleto: opciones.nombreCompleto,
      direccion: "Av. de las Pruebas 100, Centro, Ciudad de México",
      telefono: "5599999999",
      correo: opciones.correo,
      rfc: opciones.rfc,
      password: passwordHasheada,
      tipo: opciones.tipo,
      correoVerificado: true,
      ineFrente: "/uploads/ine/prueba-frente.jpg",
      ineReverso: "/uploads/ine/prueba-reverso.jpg",
      aceptaTerminos: true,
      recibirNotificacionesCriticas: true,
      recibirNotificacionesPublicitarias: false,
      paypalEmail: CORREO_PAYPAL,
      horarios: HORARIOS_SIEMPRE,
      horarioConfirmadoEn,
      diasSinConfirmarHorario: 0,
      ...(opciones.curp ? { curp: opciones.curp } : {}),
      ...(opciones.ineCodigoReverso
        ? { ineCodigoReverso: opciones.ineCodigoReverso }
        : {}),
      ...(opciones.estadoCuenta ? { estadoCuenta: opciones.estadoCuenta } : {}),
      ...(opciones.canceladaEn ? { canceladaEn: opciones.canceladaEn } : {}),
    },
  });

  await Usuario.updateOne(
    { correo: opciones.correo },
    {
      $set: {
        usuarioId: creado.id,
        nombreCompleto: opciones.nombreCompleto,
        direccion: "Av. de las Pruebas 100, Centro, Ciudad de México",
        telefono: "5599999999",
        correo: opciones.correo,
        rfc: opciones.rfc,
        password: passwordHasheada,
        tipo: opciones.tipo,
        correoVerificado: true,
        ineFrente: "/uploads/ine/prueba-frente.jpg",
        ineReverso: "/uploads/ine/prueba-reverso.jpg",
        aceptaTerminos: true,
        recibirNotificacionesCriticas: true,
        recibirNotificacionesPublicitarias: false,
        metodoPago: "paypal",
        datosMetodoPago: CORREO_PAYPAL,
        horarios: HORARIOS_SIEMPRE,
        horarioConfirmadoEn,
        diasSinConfirmarHorario: 0,
        puntosReputacion: 0,
        ...(opciones.curp ? { curp: opciones.curp } : {}),
        ...(opciones.ineCodigoReverso
          ? { ineCodigoReverso: opciones.ineCodigoReverso }
          : {}),
        ...(opciones.estadoCuenta ? { estadoCuenta: opciones.estadoCuenta } : {}),
        ...(opciones.canceladaEn ? { canceladaEn: opciones.canceladaEn } : {}),
      },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true },
  );

  idsCuentas.push(creado.id);
  correosCuentas.push(opciones.correo);
  return creado.id;
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

  // -------------------------------------------------------------------------
  // Preparación: vendedor de prueba, administrador y productos.
  // -------------------------------------------------------------------------
  const vendedorId = await crearCuentaDePrueba({
    correo: CORREO_VENDEDOR,
    nombreCompleto: "Vendedor Puntos Prueba",
    password: PASSWORD_VENDEDOR,
    tipo: "vendedor",
    rfc: RFC_VENDEDOR,
    curp: CURP_VENDEDOR,
    ineCodigoReverso: MRZ_VENDEDOR,
    estadoCuenta: "activa",
  });
  const adminId = await crearCuentaDePrueba({
    correo: CORREO_ADMIN,
    nombreCompleto: "Administrador Puntos Prueba",
    password: PASSWORD_ADMIN,
    tipo: "admin",
    rfc: `AD${marca}QWE`,
  });

  const tokenVendedor = await iniciarSesion(CORREO_VENDEDOR, PASSWORD_VENDEDOR);
  verificar(
    "Cuenta de prueba del vendedor disponible (login por su espejo de MongoDB)",
    !!tokenVendedor,
    "no se pudo iniciar sesión con la cuenta creada",
  );
  const tokenAdmin = await iniciarSesion(CORREO_ADMIN, PASSWORD_ADMIN);
  verificar(
    "Cuenta de prueba del administrador disponible",
    !!tokenAdmin,
    "no se pudo iniciar sesión con el administrador creado",
  );

  const p0 = tokenVendedor
    ? await crearProducto("Producto de prueba puntos cero", tokenVendedor, 100)
    : null;
  const p1 = tokenVendedor
    ? await crearProducto("Producto de prueba puntos uno", tokenVendedor, 120)
    : null;
  const p2 = tokenVendedor
    ? await crearProducto("Producto de prueba puntos dos", tokenVendedor, 140)
    : null;
  verificar(
    "Productos de prueba creados con la moderación simulada",
    [p0, p1, p2].every(Boolean),
    `${productosCreados.length} de 3 productos`,
  );

  // El vendedor tiene un vínculo de PayPal (token cifrado) que debe
  // conservarse mientras haya entregas y borrarse en la purga (RQNF10.6).
  await VinculoPayPal.create({
    usuarioId: vendedorId,
    correoPayPal: CORREO_PAYPAL,
    merchantId: `MKT-${vendedorId}`,
    tokenCifrado: "token-de-prueba-cifrado",
  });

  // -------------------------------------------------------------------------
  // Suite 1: venta completada antes de la cancelación y reputación promedio
  // (RQNF10.1).
  // -------------------------------------------------------------------------
  let ventaMongoId0: string | null = null;
  let venta0 = 0;
  if (p0 && tokenVendedor) {
    const compra0 = await pagarConPaypal(
      p0.id,
      COMPRADOR_UNO,
      `uno.puntos.${marca}@ejemplo.test`,
    );
    venta0 = Number(compra0.ventaId ?? 0);
    if (!compra0.ok || !venta0) {
      verificar(
        "RQNF10.1 se puede calificar una venta completada del vendedor",
        false,
        compra0.detalle,
      );
    } else {
      await subirComprobanteDeVenta(venta0, COMPRADOR_UNO, {
        palabraClave: String(compra0.codigoPago),
        referencia: "REF-P0-0001",
      });
      await confirmarComprobante(venta0, tokenVendedor);
      const compra0Lista = (await misCompras(COMPRADOR_UNO)).find(
        (compra) => compra.ventaId === venta0,
      );
      // Fase 7b (RQNF32): la venta nace retenida para protegerla de los
      // crons; el flujo real no retiene ventas sanas.
      await actualizarVenta(venta0, { retenido: false });
      const entrega0 = await confirmarEntrega(
        venta0,
        tokenVendedor,
        String(compra0Lista?.codigoEntrega ?? ""),
      );
      ventaMongoId0 = (compra0Lista?.ventaMongoId as string | null) ?? null;
      registrarVenta(venta0, compra0.orderId ?? "", ventaMongoId0);
      verificar(
        "Venta de preparación completada (RQNF27)",
        entrega0.status === 200 && entrega0.cuerpo?.estado === "completada",
        `${entrega0.status}: ${JSON.stringify(entrega0.cuerpo)}`,
      );

      const perfilSinCalificar = await fetch(`${BASE}/api/usuarios/perfil`, {
        headers: { Authorization: `Bearer ${tokenVendedor}` },
      });
      const perfilDatos = (await perfilSinCalificar.json().catch(() => null)) as any;
      verificar(
        "RQNF10.1 sin calificaciones la reputación promedio es nula",
        perfilDatos?.reputacion?.promedio === null &&
          perfilDatos?.reputacion?.totalCalificaciones === 0,
        JSON.stringify(perfilDatos?.reputacion),
      );

      if (ventaMongoId0) {
        const calificacion = await calificar(
          ventaMongoId0,
          { compradorId: COMPRADOR_UNO },
          "comprador",
          5,
        );
        verificar(
          "RQNF10.1 el comprador califica la entrega completada",
          calificacion.status === 200,
          `${calificacion.status}: ${JSON.stringify(calificacion.cuerpo)}`,
        );

        const rVentas = await fetch(`${BASE}/api/pagos/vendedor/ventas`, {
          headers: { Authorization: `Bearer ${tokenVendedor}` },
        });
        const panel = (await rVentas.json().catch(() => null)) as any;
        verificar(
          "RQNF10.1 la reputación promedio del vendedor es el promedio de las calificaciones",
          rVentas.ok &&
            panel?.reputacion?.promedio === 5 &&
            panel?.reputacion?.totalCalificaciones === 1 &&
            panel?.cuenta?.estadoCuenta === "activa" &&
            panel?.cuenta?.puntosReputacion === 0 &&
            panel?.cuenta?.puntosCancelacion === 8,
          JSON.stringify({ cuenta: panel?.cuenta, reputacion: panel?.reputacion }),
        );
      }
    }
  }

  // -------------------------------------------------------------------------
  // Suite 2: ventas pendientes al momento de la cancelación (RQF12) y fila
  // sin pago de un tercero (RQNF10.7).
  // -------------------------------------------------------------------------
  let venta1 = 0;
  let venta2 = 0;
  let ventaMongoId1: string | null = null;
  if (p1 && tokenVendedor) {
    const compra1 = await pagarConPaypal(
      p1.id,
      COMPRADOR_UNO,
      `uno.puntos.${marca}@ejemplo.test`,
    );
    venta1 = Number(compra1.ventaId ?? 0);
    if (compra1.ok && venta1) {
      await subirComprobanteDeVenta(venta1, COMPRADOR_UNO, {
        palabraClave: String(compra1.codigoPago),
        referencia: "REF-P1-0001",
      });
      await confirmarComprobante(venta1, tokenVendedor);
      const compra1Lista = (await misCompras(COMPRADOR_UNO)).find(
        (compra) => compra.ventaId === venta1,
      );
      ventaMongoId1 = (compra1Lista?.ventaMongoId as string | null) ?? null;
      registrarVenta(venta1, compra1.orderId ?? "", ventaMongoId1);
      verificar(
        "Venta en entrega preparada para probar RQF12",
        compra1Lista?.estado === "en_entrega",
        JSON.stringify(compra1Lista).slice(0, 200),
      );
    } else {
      verificar("Venta en entrega preparada para probar RQF12", false, compra1.detalle);
    }
  }

  if (p2 && tokenVendedor) {
    const compra2 = await pagarConPaypal(
      p2.id,
      COMPRADOR_DOS,
      `dos.puntos.${marca}@ejemplo.test`,
    );
    venta2 = Number(compra2.ventaId ?? 0);
    if (compra2.ok && venta2) {
      await subirComprobanteDeVenta(venta2, COMPRADOR_DOS, {
        palabraClave: String(compra2.codigoPago),
        referencia: "REF-P2-0001",
      });
      registrarVenta(venta2, compra2.orderId ?? "");
      verificar(
        "Venta por revisar preparada para probar RQF12",
        (await leerVenta(venta2))?.estado === "pendiente_confirmacion",
        `estado=${(await leerVenta(venta2))?.estado}`,
      );
    } else {
      verificar("Venta por revisar preparada para probar RQF12", false, compra2.detalle);
    }

    // RQNF10.7: un cliente espera su turno sin haber pagado todavía.
    const filaTres = await entrarAFila(
      p2.id,
      COMPRADOR_TRES,
      `tres.puntos.${marca}@ejemplo.test`,
    );
    verificar(
      "RQNF10.7 fila de un cliente sin pagar preparada para la cancelación",
      filaTres.status === 201,
      `${filaTres.status}: ${await mensajeDe(filaTres)}`,
    );
  }

  // -------------------------------------------------------------------------
  // Suite 3: puntos por reportes confirmados (RQNF10.1) hasta el umbral.
  // -------------------------------------------------------------------------
  if (tokenAdmin) {
    const categoriasUno = [
      { id: "falta_respeto", puntos: 1.5 },
      { id: "lenguaje_ofensivo", puntos: 1.5 },
      { id: "actitud_hostil", puntos: 1 },
      { id: "spam", puntos: 1 },
      { id: "otro", puntos: 1 },
    ];

    let totalEsperado = 0;
    let reportesCreadosOk = true;
    for (const categoria of categoriasUno) {
      const creado = await crearReporte(COMPRADOR_UNO, vendedorId, categoria.id);
      if (creado.status !== 201) {
        reportesCreadosOk = false;
        console.error(
          `No se pudo crear el reporte ${categoria.id}: ${creado.status} ${JSON.stringify(creado.cuerpo)}`,
        );
      }
    }
    verificar(
      "RQNF10.1 el comprador reporta al vendedor en las 5 categorías leves",
      reportesCreadosOk,
      "revisa la salida de consola",
    );

    const pendientesResp = await fetch(`${BASE}/api/admin/reportes/pendientes`, {
      headers: { Authorization: `Bearer ${tokenAdmin}` },
    });
    const pendientes = (await pendientesResp.json().catch(() => null)) as any;
    const listaPendientes: any[] = pendientes?.reportes ?? pendientes ?? [];
    const puntosEnLista = listaPendientes
      .filter((r) => categoriasUno.some((c) => c.id === r.categoria))
      .map((r) => r.puntos);
    verificar(
      "RQNF10.1 el panel del administrador muestra los puntos de cada reporte",
      pendientesResp.ok &&
        puntosEnLista.includes(1.5) &&
        puntosEnLista.includes(1) &&
        listaPendientes.some((r) => r.puntosCancelacion === 8) &&
        listaPendientes.every((r) => r.puntosReputacion === 0),
      `puntos=${JSON.stringify(puntosEnLista)}`,
    );

    for (const categoria of categoriasUno) {
      const reporte = await buscarReporte(vendedorId, COMPRADOR_UNO, categoria.id);
      if (!reporte) {
        verificar(
          `RQNF10.1 confirmar el reporte ${categoria.id} suma ${categoria.puntos} puntos`,
          false,
          "reporte no encontrado en PostgreSQL",
        );
        continue;
      }
      const resuelto = await resolverReporte(Number(reporte.id), tokenAdmin, "confirmado");
      totalEsperado = Math.round((totalEsperado + categoria.puntos) * 10) / 10;
      verificar(
        `RQNF10.1 confirmar el reporte ${categoria.id} suma ${categoria.puntos} puntos`,
        resuelto.status === 200 &&
          resuelto.cuerpo?.puntos === categoria.puntos &&
          resuelto.cuerpo?.puntosReputacion === totalEsperado &&
          resuelto.cuerpo?.cuentaCancelada === false,
        `${resuelto.status}: ${JSON.stringify(resuelto.cuerpo)}`,
      );
    }

    const vendedorTrasSeis = await clientePrisma.usuario.findUnique({
      where: { id: vendedorId },
    });
    verificar(
      "RQNF10.1 con 6 puntos la cuenta sigue activa",
      vendedorTrasSeis?.puntosReputacion === 6 &&
        vendedorTrasSeis?.estadoCuenta === "activa",
      `puntos=${vendedorTrasSeis?.puntosReputacion} estado=${vendedorTrasSeis?.estadoCuenta}`,
    );

    // Un reporte rechazado no suma puntos.
    const creadoRechazo = await crearReporte(COMPRADOR_DOS, vendedorId, "spam");
    const reporteRechazo = await buscarReporte(vendedorId, COMPRADOR_DOS, "spam");
    if (creadoRechazo.status === 201 && reporteRechazo) {
      const rechazado = await resolverReporte(
        Number(reporteRechazo.id),
        tokenAdmin,
        "rechazado",
      );
      const vendedorSinCambio = await clientePrisma.usuario.findUnique({
        where: { id: vendedorId },
      });
      verificar(
        "RQNF10.1 un reporte rechazado no suma puntos",
        rechazado.status === 200 &&
          rechazado.cuerpo?.estado === "rechazado" &&
          vendedorSinCambio?.puntosReputacion === 6,
        `${rechazado.status}: ${JSON.stringify(rechazado.cuerpo)} puntos=${vendedorSinCambio?.puntosReputacion}`,
      );
    } else {
      verificar(
        "RQNF10.1 un reporte rechazado no suma puntos",
        false,
        `no se pudo crear: ${creadoRechazo.status} ${JSON.stringify(creadoRechazo.cuerpo)}`,
      );
    }

    // RQNF10.3: con 7.5 puntos todavía no se cancela.
    const creado75 = await crearReporte(
      COMPRADOR_DOS,
      vendedorId,
      "lenguaje_ofensivo",
    );
    const reporte75 = await buscarReporte(
      vendedorId,
      COMPRADOR_DOS,
      "lenguaje_ofensivo",
    );
    if (creado75.status === 201 && reporte75) {
      const resuelto75 = await resolverReporte(Number(reporte75.id), tokenAdmin, "confirmado");
      const vendedor75 = await clientePrisma.usuario.findUnique({
        where: { id: vendedorId },
      });
      verificar(
        "RQNF10.3 con 7.5 puntos la cuenta todavía no se cancela",
        resuelto75.status === 200 &&
          resuelto75.cuerpo?.puntosReputacion === 7.5 &&
          resuelto75.cuerpo?.cuentaCancelada === false &&
          vendedor75?.estadoCuenta === "activa",
        `${resuelto75.status}: ${JSON.stringify(resuelto75.cuerpo)}`,
      );
    } else {
      verificar(
        "RQNF10.3 con 7.5 puntos la cuenta todavía no se cancela",
        false,
        `no se pudo crear: ${creado75.status} ${JSON.stringify(creado75.cuerpo)}`,
      );
    }

    // RQNF10.3: el reporte que llega a 8 puntos cancela la cuenta.
    const creado8 = await crearReporte(COMPRADOR_DOS, vendedorId, "actitud_hostil");
    const reporte8 = await buscarReporte(
      vendedorId,
      COMPRADOR_DOS,
      "actitud_hostil",
    );
    if (creado8.status === 201 && reporte8) {
      const resuelto8 = await resolverReporte(Number(reporte8.id), tokenAdmin, "confirmado");
      const vendedorCancelado = await clientePrisma.usuario.findUnique({
        where: { id: vendedorId },
      });
      verificar(
        "RQNF10.3/RQF10 al llegar a 8 puntos la cuenta se cancela de forma permanente",
        resuelto8.status === 200 &&
          resuelto8.cuerpo?.cuentaCancelada === true &&
          resuelto8.cuerpo?.puntosReputacion === 8.5 &&
          String(resuelto8.cuerpo?.message ?? "").includes("cancelada") &&
          vendedorCancelado?.estadoCuenta === "cancelada" &&
          vendedorCancelado?.canceladaEn instanceof Date,
        `${resuelto8.status}: ${JSON.stringify(resuelto8.cuerpo)} estado=${vendedorCancelado?.estadoCuenta}`,
      );

      const espejo = await Usuario.findOne({ usuarioId: vendedorId }).lean();
      verificar(
        "RQNF10.3 el espejo de MongoDB también queda cancelado (panel del administrador)",
        espejo?.estadoCuenta === "cancelada",
        `estadoCuenta=${espejo?.estadoCuenta}`,
      );

      // RQNF10.5 / RQF11: el correo sale por consola (modo local); el
      // contenido exacto ya está cubierto por la plantilla y el registro.
      // RQNF10.6: alta inmediata en la lista negra con el RFC/CURP/INE.
      const entradaLista = await ListaNegra.findOne({ rfc: RFC_VENDEDOR }).lean();
      verificar(
        "RQNF10.6/RQNF1.9 el RFC queda en la lista negra al cancelar la cuenta",
        entradaLista?.origen === "cuenta-eliminada" &&
          entradaLista?.curp === CURP_VENDEDOR &&
          String(entradaLista?.motivo ?? "").includes("8 puntos"),
        `origen=${entradaLista?.origen} motivo=${entradaLista?.motivo}`,
      );

      // RQNF10.6: las publicaciones dejan de estar activas.
      const p1TrasCancelar = await Producto.findById(p1?.id);
      const p2TrasCancelar = await Producto.findById(p2?.id);
      verificar(
        "RQNF10.6/RQF12 las publicaciones del vendedor cancelado se desactivan",
        p1TrasCancelar?.activo === false && p2TrasCancelar?.activo === false,
        `p1=${p1TrasCancelar?.activo} p2=${p2TrasCancelar?.activo}`,
      );

      // RQNF10.7: la fila del cliente que no pagó se cancela.
      const filaTresTrasCancelar = p2
        ? await leerFila(p2.id, COMPRADOR_TRES)
        : null;
      verificar(
        "RQNF10.7 la fila del cliente que aún no pagaba se cancela y se le avisa",
        filaTresTrasCancelar?.estado === "cancelada",
        `estado de la fila=${filaTresTrasCancelar?.estado}`,
      );

      // RQNF10.6: con entregas pendientes los datos y el token de PayPal
      // todavía se conservan (se purgan al resolverse la última entrega).
      const vinculoTrasCancelar = await VinculoPayPal.countDocuments({
        usuarioId: vendedorId,
      });
      verificar(
        "RQNF10.6 el token de PayPal se conserva mientras haya entregas pendientes",
        vinculoTrasCancelar === 1,
        `vinculos=${vinculoTrasCancelar}`,
      );
    } else {
      verificar(
        "RQNF10.3/RQF10 al llegar a 8 puntos la cuenta se cancela de forma permanente",
        false,
        `no se pudo crear: ${creado8.status} ${JSON.stringify(creado8.cuerpo)}`,
      );
    }
  }

  // -------------------------------------------------------------------------
  // Suite 4: RQF12 — acceso restringido del vendedor cancelado.
  // -------------------------------------------------------------------------
  const tokenCancelado = await iniciarSesion(CORREO_VENDEDOR, PASSWORD_VENDEDOR);
  verificar(
    "RQF12 el vendedor cancelado conserva el acceso mientras tenga entregas pendientes",
    !!tokenCancelado,
    "no pudo iniciar sesión tras la cancelación",
  );

  if (tokenCancelado) {
    const rPublicar = await fetch(`${BASE}/api/productos`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tokenCancelado}` },
      body: cuerpoProducto({ nombre: "Producto no permitido cancelado" }),
    });
    verificar(
      "RQF12 una cuenta cancelada no puede publicar productos",
      rPublicar.status === 403 &&
        String(await mensajeDe(rPublicar)).includes("cancelada"),
      `status ${rPublicar.status}`,
    );

    const rHorario = await fetch(`${BASE}/api/usuarios/confirmar-horario`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${tokenCancelado}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ horarios: HORARIOS }),
    });
    verificar(
      "RQF12 una cuenta cancelada no puede confirmar horario",
      rHorario.status === 403,
      `status ${rHorario.status}`,
    );

    const rPreferencias = await fetch(`${BASE}/api/usuarios/preferencias`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${tokenCancelado}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ recibirNotificacionesPublicitarias: true }),
    });
    verificar(
      "RQF12 una cuenta cancelada no puede cambiar sus preferencias",
      rPreferencias.status === 403,
      `status ${rPreferencias.status}`,
    );

    if (ventaMongoId0) {
      const rCalificar = await calificar(
        ventaMongoId0,
        { token: tokenCancelado },
        "vendedor",
        4,
      );
      verificar(
        "RQF12 una cuenta cancelada no puede calificar (solo completar entregas)",
        rCalificar.status === 403,
        `${rCalificar.status}: ${JSON.stringify(rCalificar.cuerpo)}`,
      );
    }

    const rPanel = await fetch(`${BASE}/api/pagos/vendedor/ventas`, {
      headers: { Authorization: `Bearer ${tokenCancelado}` },
    });
    const panelCancelado = (await rPanel.json().catch(() => null)) as any;
    const ventasEnPanel: any[] = panelCancelado?.ventas ?? [];
    verificar(
      "RQF12 la cuenta cancelada sí puede ver sus entregas pendientes",
      rPanel.ok &&
        panelCancelado?.cuenta?.estadoCuenta === "cancelada" &&
        panelCancelado?.cuenta?.puntosReputacion === 8.5 &&
        panelCancelado?.cuenta?.puntosCancelacion === 8 &&
        panelCancelado?.reputacion?.promedio === 5 &&
        ventasEnPanel.some((v) => v.ventaId === venta1) &&
        ventasEnPanel.some((v) => v.ventaId === venta2),
      `status ${rPanel.status}: ${JSON.stringify(panelCancelado?.cuenta)}`,
    );

    const rPerfil = await fetch(`${BASE}/api/usuarios/perfil`, {
      headers: { Authorization: `Bearer ${tokenCancelado}` },
    });
    const perfilCancelado = (await rPerfil.json().catch(() => null)) as any;
    verificar(
      "RQNF10.1/RQF12 el perfil muestra la cuenta cancelada, los puntos y la reputación",
      rPerfil.ok &&
        perfilCancelado?.estadoCuenta === "cancelada" &&
        perfilCancelado?.puntosReputacion === 8.5 &&
        perfilCancelado?.puntosCancelacion === 8 &&
        perfilCancelado?.reputacion?.promedio === 5,
      JSON.stringify({
        estado: perfilCancelado?.estadoCuenta,
        puntos: perfilCancelado?.puntosReputacion,
      }),
    );
  }

  if (tokenAdmin) {
    const rUsuarios = await fetch(`${BASE}/api/admin/usuarios?porPagina=100`, {
      headers: { Authorization: `Bearer ${tokenAdmin}` },
    });
    const usuariosAdmin = (await rUsuarios.json().catch(() => null)) as any;
    const vendedorEnLista = (usuariosAdmin?.usuarios ?? []).find(
      (u: any) => u.correo === CORREO_VENDEDOR,
    );
    verificar(
      "RQNF10.1 el panel de usuarios muestra los puntos y el estado cancelada",
      rUsuarios.ok &&
        vendedorEnLista?.puntosReputacion === 8.5 &&
        vendedorEnLista?.estadoCuenta === "cancelada",
      JSON.stringify(vendedorEnLista),
    );

    const rResumen = await fetch(`${BASE}/api/admin/resumen`, {
      headers: { Authorization: `Bearer ${tokenAdmin}` },
    });
    const resumen = (await rResumen.json().catch(() => null)) as any;
    verificar(
      "El resumen del administrador cuenta las cuentas canceladas",
      rResumen.ok && (resumen?.usuarios?.cancelados ?? 0) >= 1,
      `cancelados=${resumen?.usuarios?.cancelados}`,
    );
  }

  // -------------------------------------------------------------------------
  // Suite 5: RQF12 — completar las entregas pendientes y purga total
  // (RQNF10.6).
  // -------------------------------------------------------------------------
  if (tokenCancelado) {
    // La venta por revisar se confirma (el comprobante ya estaba enviado).
    const confirmacion2 = await confirmarComprobante(venta2, tokenCancelado);
    verificar(
      "RQF12 la cuenta cancelada puede confirmar el comprobante de una entrega pendiente",
      confirmacion2.status === 200 &&
        confirmacion2.cuerpo?.estado === "en_entrega",
      `${confirmacion2.status}: ${JSON.stringify(confirmacion2.cuerpo)}`,
    );

    // Un mensaje de chat de la venta en entrega, para verificar su purga.
    if (ventaMongoId1) {
      const mensaje = await enviarMensajeComprador(
        ventaMongoId1,
        COMPRADOR_UNO,
        "Mensaje de prueba que debe desaparecer con la purga",
      );
      verificar(
        "RQNF29 la venta en entrega conserva su chat habilitado",
        mensaje.status === 201,
        `${mensaje.status}: ${JSON.stringify(mensaje.cuerpo)}`,
      );
    }

    // Completar la primera entrega: aún queda la segunda, no se purga.
    const compra1Final = (await misCompras(COMPRADOR_UNO)).find(
      (compra) => compra.ventaId === venta1,
    );
    await actualizarVenta(venta1, { retenido: false });
    const entrega1 = await confirmarEntrega(
      venta1,
      tokenCancelado,
      String(compra1Final?.codigoEntrega ?? ""),
    );
    const vendedorTrasPrimera = await clientePrisma.usuario.findUnique({
      where: { id: vendedorId },
    });
    verificar(
      "RQF12/RQNF10.6 completar una entrega no purga mientras queden pendientes",
      entrega1.status === 200 &&
        entrega1.cuerpo?.estado === "completada" &&
        vendedorTrasPrimera?.datosEliminadosEn === null &&
        (await Usuario.countDocuments({ usuarioId: vendedorId })) === 1,
      `${entrega1.status}: ${JSON.stringify(entrega1.cuerpo)} purgado=${vendedorTrasPrimera?.datosEliminadosEn}`,
    );

    // Completar la última entrega: purga total (RQNF10.6).
    const compra2Final = (await misCompras(COMPRADOR_DOS)).find(
      (compra) => compra.ventaId === venta2,
    );
    await actualizarVenta(venta2, { retenido: false });
    const entrega2 = await confirmarEntrega(
      venta2,
      tokenCancelado,
      String(compra2Final?.codigoEntrega ?? ""),
    );
    verificar(
      "RQNF10.6 al resolverse la última entrega la transacción se completa",
      entrega2.status === 200 && entrega2.cuerpo?.estado === "completada",
      `${entrega2.status}: ${JSON.stringify(entrega2.cuerpo)}`,
    );

    const vendedorPurgado = await clientePrisma.usuario.findUnique({
      where: { id: vendedorId },
    });
    verificar(
      "RQNF10.6 la purga borra nombre, domicilio, teléfono, correo y contraseña",
      vendedorPurgado?.nombreCompleto === "Cuenta cancelada" &&
        vendedorPurgado?.direccion === "" &&
        vendedorPurgado?.telefono === "" &&
        vendedorPurgado?.correo ===
          `cuenta-cancelada-${vendedorId}@ichiba.invalid` &&
        String(vendedorPurgado?.password ?? "").startsWith("eliminado-") &&
        vendedorPurgado?.rfc === "ELIMINADO" &&
        vendedorPurgado?.datosEliminadosEn instanceof Date,
      JSON.stringify({
        correo: vendedorPurgado?.correo,
        rfc: vendedorPurgado?.rfc,
        eliminado: vendedorPurgado?.datosEliminadosEn,
      }),
    );

    verificar(
      "RQNF10.6 la cuenta desaparece de MongoDB (ya no puede iniciar sesión)",
      (await Usuario.countDocuments({ usuarioId: vendedorId })) === 0,
      `documentos=${await Usuario.countDocuments({ usuarioId: vendedorId })}`,
    );
    const loginTrasPurga = await iniciarSesion(CORREO_VENDEDOR, PASSWORD_VENDEDOR);
    verificar(
      "RQNF10.6 después de la purga el inicio de sesión falla",
      loginTrasPurga === null,
      `token=${loginTrasPurga ? "obtenido" : "null"}`,
    );

    verificar(
      "RQNF10.6 la purga borra el token de acceso de PayPal",
      (await VinculoPayPal.countDocuments({ usuarioId: vendedorId })) === 0,
      `vinculos=${await VinculoPayPal.countDocuments({ usuarioId: vendedorId })}`,
    );
    verificar(
      "RQNF10.6 la purga borra sus publicaciones",
      (await Producto.countDocuments({ vendedorId: String(vendedorId) })) === 0,
      `productos=${await Producto.countDocuments({ vendedorId: String(vendedorId) })}`,
    );
    if (ventaMongoId1) {
      verificar(
        "RQNF10.6 la purga borra el historial de chats",
        (await Mensaje.countDocuments({ ventaId: ventaMongoId1 })) === 0,
        `mensajes=${await Mensaje.countDocuments({ ventaId: ventaMongoId1 })}`,
      );
    }

    const comprasUno = await misCompras(COMPRADOR_UNO);
    verificar(
      "RQNF10.6 las ventas se conservan para los compradores tras la purga",
      comprasUno.some(
        (compra) => compra.ventaId === venta1 && compra.estado === "completada",
      ),
      JSON.stringify(comprasUno.map((c) => ({ id: c.ventaId, estado: c.estado }))),
    );
  }

  // -------------------------------------------------------------------------
  // Suite 6: el trabajo periódico purga cuentas canceladas sin pendientes.
  // -------------------------------------------------------------------------
  const idPurga = await crearCuentaDePrueba({
    correo: CORREO_PURGA,
    nombreCompleto: "Vendedor Purga Prueba",
    password: "PurgaIchiba123!",
    tipo: "vendedor",
    rfc: RFC_PURGA,
    estadoCuenta: "cancelada",
    canceladaEn: new Date(),
  });
  const productoPurga = await Producto.create({
    nombre: "Producto de prueba purga",
    precio: 500,
    imagenes: [],
    categoria: "hogar",
    descripcion: "producto de la cuenta cancelada sin entregas pendientes",
    vendedor: "Vendedor Purga Prueba",
    vendedorId: String(idPurga),
    condicionUso: "nuevo",
    horarioEntregaInicio: "09:00",
    horarioEntregaFin: "18:00",
  });
  await VinculoPayPal.create({
    usuarioId: idPurga,
    correoPayPal: CORREO_PAYPAL,
    merchantId: `MKT-${idPurga}`,
    tokenCifrado: "token-de-prueba-cifrado",
  });

  const accionesPurga = await ejecutarRevisor();
  const purgaHecha = await clientePrisma.usuario.findUnique({
    where: { id: idPurga },
  });
  verificar(
    "RQNF10.6 el trabajo periódico purga las cuentas canceladas sin entregas pendientes",
    accionesPurga.some(
      (accion) =>
        accion.includes(`Cuenta ${idPurga}`) && accion.includes("purgados"),
    ) &&
      purgaHecha?.datosEliminadosEn instanceof Date &&
      purgaHecha?.correo === `cuenta-cancelada-${idPurga}@ichiba.invalid`,
    `acciones=${JSON.stringify(accionesPurga)} correo=${purgaHecha?.correo}`,
  );
  verificar(
    "RQNF10.6 la purga del trabajo borra su espejo y sus publicaciones",
    (await Usuario.countDocuments({ usuarioId: idPurga })) === 0 &&
      (await Producto.countDocuments({ _id: productoPurga._id })) === 0 &&
      (await VinculoPayPal.countDocuments({ usuarioId: idPurga })) === 0,
    "quedaron documentos sin borrar",
  );
} finally {
  // -------------------------------------------------------------------------
  // Limpieza: archivos de comprobantes, filas y ventas de prueba en
  // PostgreSQL, espejos, reportes, sanciones, lista negra y cuentas.
  // -------------------------------------------------------------------------
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
    for (const idCuenta of idsCuentas) {
      await clientePrisma.venta.deleteMany({ where: { vendedorId: idCuenta } });
      await clientePrisma.reporte.deleteMany({ where: { vendedorId: idCuenta } });
    }
    for (const ventaId of ventasCreadas) {
      await clientePrisma.venta.deleteMany({ where: { id: ventaId } });
    }
  } catch (error) {
    console.error("[limpieza] No se pudieron borrar filas/ventas/reportes:", error);
  }

  try {
    if (pedidosCreados.length > 0) {
      await Venta.deleteMany({ paypalOrderId: { $in: pedidosCreados } });
    }
    if (ventasMongoIds.size > 0) {
      await Mensaje.deleteMany({ ventaId: { $in: [...ventasMongoIds] } });
    }
  } catch (error) {
    console.error("[limpieza] No se pudieron borrar los espejos de Mongo:", error);
  }

  try {
    const idsTexto = idsCuentas.map(String);
    await Sancion.deleteMany({ sujetoId: { $in: idsTexto } });
    await ListaNegra.deleteMany({
      $or: [
        { rfc: RFC_VENDEDOR },
        { rfc: RFC_PURGA },
        { curp: CURP_VENDEDOR },
        { ineCodigoReverso: MRZ_VENDEDOR },
      ],
    });
    await VinculoPayPal.deleteMany({ usuarioId: { $in: idsCuentas } });
    await EstadoVinculacionPayPal.deleteMany({ usuarioId: { $in: idsCuentas } });
  } catch (error) {
    console.error("[limpieza] No se pudieron borrar sanciones/listas:", error);
  }

  for (const producto of productosCreados) {
    try {
      await Producto.deleteOne({ _id: producto.id });
    } catch {
      /* ignorar */
    }
    for (const imagen of producto.imagenes) {
      try {
        const ruta = path.join(RAIZ, imagen.replace(/^\//, ""));
        if (fs.existsSync(ruta)) fs.unlinkSync(ruta);
      } catch {
        /* ignorar */
      }
    }
  }
  try {
    await Producto.deleteMany({ vendedorId: idsCuentas.map(String) });
  } catch {
    /* ignorar */
  }

  try {
    for (const idCuenta of idsCuentas) {
      await clientePrisma.usuario.deleteMany({ where: { id: idCuenta } });
    }
  } catch (error) {
    console.error("[limpieza] No se pudieron borrar las cuentas de PostgreSQL:", error);
  }
  try {
    await Usuario.deleteMany({ correo: { $in: correosCuentas } });
  } catch (error) {
    console.error("[limpieza] No se pudieron borrar las cuentas de MongoDB:", error);
  }

  for (const hijo of hijos) {
    try {
      hijo.kill();
    } catch {
      /* ignorar */
    }
  }
  for (const servidor of [servidorPaypal, servidorVision]) {
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
  `\nSuite de puntos y cancelación: ${resultados.length - fallas.length}/${resultados.length} pruebas pasaron`,
);
if (fallas.length > 0) {
  console.log("Fallas:");
  for (const falla of fallas) console.log(` - ${falla.nombre}: ${falla.detalle}`);
  process.exit(1);
}
process.exit(0);
