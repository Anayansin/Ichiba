/**
 * Pruebas E2E de RQF40 (disputas de reembolso), RQNF32 (retención preventiva
 * del escrow), RQNF37 (adeudos por culpa del vendedor) y RQNF38 (reactivación
 * con la liquidación total).
 *
 * Cubre:
 *  1. RQF40: el comprador abre la disputa de una compra `en_entrega` o
 *     `completada` con motivo, descripción y evidencias; solo una por compra y
 *     solo su comprador. El vendedor responde con su versión y sus evidencias.
 *  2. RQNF32: mientras la disputa siga abierta el pago queda retenido: el
 *     vendedor no puede liberar la captura (`confirmar-entrega` bloqueado). Al
 *     rechazarse la disputa (o el reporte que retenía) se retira la retención.
 *  3. RQF40: la administración revisa todo desde el BackOffice y dictamina
 *     reembolsar o rechazar; las ventas retenidas por reportes o reembolsos
 *     fallidos se resuelven en la misma sección.
 *  4. RQNF37: todo reembolso por culpa directa del vendedor registra su adeudo
 *     (disputa, venta retenida con causa), suspende la cuenta con
 *     `saldo_pendiente` y los adeudos se acumulan.
 *  5. RQNF38: el suspendido por saldo puede iniciar sesión y terminar entregas
 *     en curso, pero no publicar; al liquidar el último adeudo se reactiva.
 *  6. Las evidencias solo las ven el comprador, el vendedor y la
 *     administración (nunca como archivos estáticos).
 *  7. La suscripción GraphQL `disputasActualizadas` avisa al BackOffice.
 *
 * Levanta un backend de prueba en el puerto 5103 con mocks locales de PayPal y
 * Cloud Vision, y usa directamente PostgreSQL/MongoDB locales (mismos que el
 * backend de desarrollo).
 *
 * Uso (con MongoDB y PostgreSQL locales corriendo):
 *   node --harmony-temporal --import tsx scripts/probar-disputas.ts
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
import WebSocket from "ws";
import { createClient, type Client } from "graphql-ws";
import clientePrisma from "../src/configuracion/prisma.js";
import { Producto } from "../src/models/producto.js";
import { Venta } from "../src/models/Venta.js";
import { Usuario } from "../src/models/usuario.js";
import { Sancion } from "../src/models/Sancion.js";
import { Disputa } from "../src/models/Disputa.js";
import { Adeudo } from "../src/models/Adeudo.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(__dirname, "..");

const PUERTO_BACKEND = 5103;
const PUERTO_MOCK_PAYPAL = 59096;
const PUERTO_MOCK_VISION = 59099;
const BASE = `http://127.0.0.1:${PUERTO_BACKEND}`;
const URL_WS = `ws://127.0.0.1:${PUERTO_BACKEND}/graphql`;

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
const PASSWORD = "DisputasIchiba123!";

const CORREO_V1 = `vendedor.disputas.uno.${marca}@ichiba.test`;
const CORREO_V2 = `vendedor.disputas.dos.${marca}@ichiba.test`;
const CORREO_ADMIN = `admin.disputas.${marca}@ichiba.test`;

const COMPRADOR_A1 = `comprador-disputas-a1-${marca}`;
const COMPRADOR_B1 = `comprador-disputas-b1-${marca}`;
const COMPRADOR_E1 = `comprador-disputas-e1-${marca}`;
const COMPRADOR_C1 = `comprador-disputas-c1-${marca}`;
const COMPRADOR_D1 = `comprador-disputas-d1-${marca}`;
const COMPRADOR_R1 = `comprador-disputas-r1-${marca}`;
const COMPRADOR_R2 = `comprador-disputas-r2-${marca}`;
const COMPRADOR_R3 = `comprador-disputas-r3-${marca}`;

// RQNF15: la fila solo se abre dentro del bloque de atención del vendedor;
// para que las pruebas puedan comprar a cualquier hora los vendedores de
// prueba se crean con la ventana máxima permitida.
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
  horaInicio: "00:00",
  horaFin: "23:59",
}));

// ---------------------------------------------------------------------------
// Mock de PayPal (órdenes AUTHORIZE, autorización, captura, anulación y
// reembolso)
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

// ---------------------------------------------------------------------------
// Mock de Cloud Vision (moderación de imágenes de producto y comprobantes)
// ---------------------------------------------------------------------------
const safeSearchMock = {
  adult: "VERY_UNLIKELY",
  spoof: "VERY_UNLIKELY",
  violence: "VERY_UNLIKELY",
  racy: "VERY_UNLIKELY",
};

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
const carpetaPruebas = path.join(RAIZ, "uploads", "pruebas-disputas");
fs.mkdirSync(carpetaPruebas, { recursive: true });
const rutaFotoProducto = path.join(carpetaPruebas, "producto.jpg");
const rutaComprobante = path.join(carpetaPruebas, "comprobante.png");
const rutaEvidencia1 = path.join(carpetaPruebas, "evidencia-1.jpg");
const rutaEvidencia2 = path.join(carpetaPruebas, "evidencia-2.png");

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
await sharp({
  create: {
    width: 640,
    height: 480,
    channels: 3,
    background: { r: 235, g: 210, b: 205 },
  },
})
  .jpeg()
  .toFile(rutaEvidencia1);
await sharp({
  create: {
    width: 640,
    height: 480,
    channels: 3,
    background: { r: 205, g: 215, b: 240 },
  },
})
  .png()
  .toFile(rutaEvidencia2);

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
const idsCuentas: number[] = [];
const correosCuentas: string[] = [];

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

/**
 * Crea una cuenta de prueba directamente en PostgreSQL y su espejo en
 * MongoDB (la autenticación lee el espejo, así que la contraseña va con
 * hash bcryptjs real).
 */
async function crearCuentaDePrueba(opciones: {
  correo: string;
  nombreCompleto: string;
  tipo: "vendedor" | "admin";
  rfc: string;
}): Promise<number> {
  const passwordHasheada = await bcrypt.hash(PASSWORD, 10);
  const horarioConfirmadoEn = new Date();
  const correoPaypal = `paypal.disputas.${marca}@ejemplo.test`;

  const creado = await clientePrisma.usuario.create({
    data: {
      nombreCompleto: opciones.nombreCompleto,
      direccion: "Av. de las Disputas 100, Centro, Ciudad de México",
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
      paypalEmail: correoPaypal,
      horarios: HORARIOS,
      horarioConfirmadoEn,
      diasSinConfirmarHorario: 0,
    },
  });

  await Usuario.updateOne(
    { correo: opciones.correo },
    {
      $set: {
        usuarioId: creado.id,
        nombreCompleto: opciones.nombreCompleto,
        direccion: "Av. de las Disputas 100, Centro, Ciudad de México",
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
        datosMetodoPago: correoPaypal,
        horarios: HORARIOS,
        horarioConfirmadoEn,
        diasSinConfirmarHorario: 0,
        puntosReputacion: 0,
        estadoCuenta: "activa",
      },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true },
  );

  idsCuentas.push(creado.id);
  correosCuentas.push(opciones.correo);
  return creado.id;
}

function cuerpoProducto(cambios: Record<string, string> = {}): FormData {
  const base: Record<string, string> = {
    nombre: "Artículo de prueba disputas",
    precio: "250",
    descripcion:
      "Producto de prueba del flujo de disputas con validaciones completas.",
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

type ResultadoProducto = {
  producto: ProductoCreado | null;
  status: number;
  mensaje: string;
};

async function crearProducto(
  nombre: string,
  token: string,
  precio: number,
): Promise<ResultadoProducto> {
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
  const cuerpo = (await r.json().catch(() => null)) as {
    _id?: string;
    imagenes?: string[];
    message?: string;
  } | null;
  if (!r.ok || !cuerpo?._id) {
    return {
      producto: null,
      status: r.status,
      mensaje: cuerpo?.message ?? `status ${r.status}`,
    };
  }
  const producto: ProductoCreado = {
    id: cuerpo._id,
    nombre,
    token,
    imagenes: cuerpo.imagenes ?? [],
  };
  productosCreados.push(producto);
  return { producto, status: r.status, mensaje: "" };
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

/** Lleva una compra desde el pago hasta `en_entrega` (comprobante + confirmación). */
async function llevarAVentaEnEntrega(
  productoId: string,
  compradorId: string,
  correo: string,
  referencia: string,
  tokenVendedor: string,
): Promise<{
  compra: ResultadoPago;
  comprobanteStatus: number;
  confirmacion: { status: number; cuerpo: any };
  detalleCompra: any;
}> {
  const compra = await pagarConPaypal(productoId, compradorId, correo);
  if (!compra.ok || !compra.ventaId) {
    return {
      compra,
      comprobanteStatus: 0,
      confirmacion: { status: 0, cuerpo: null },
      detalleCompra: null,
    };
  }

  const comprobante = await subirComprobanteDeVenta(compra.ventaId, compradorId, {
    palabraClave: String(compra.codigoPago),
    referencia,
  });
  const confirmacion = await confirmarComprobante(compra.ventaId, tokenVendedor);
  const detalleCompra = (await misCompras(compradorId)).find(
    (candidata) => candidata.ventaId === compra.ventaId,
  );

  return { compra, comprobanteStatus: comprobante.status, confirmacion, detalleCompra };
}

// --- Disputas ---------------------------------------------------------------

async function abrirDisputa(
  ventaId: number,
  compradorId: string,
  datos: { motivo: string; descripcion?: string; evidencias?: number },
): Promise<{ status: number; cuerpo: any }> {
  const fd = new FormData();
  fd.append("motivo", datos.motivo);
  if (datos.descripcion) fd.append("descripcion", datos.descripcion);

  const cantidad = datos.evidencias ?? 0;
  for (let indice = 0; indice < cantidad; indice++) {
    const esJpg = indice % 2 === 0;
    fd.append(
      "evidencias",
      new Blob([fs.readFileSync(esJpg ? rutaEvidencia1 : rutaEvidencia2)], {
        type: esJpg ? "image/jpeg" : "image/png",
      }),
      esJpg ? "evidencia-1.jpg" : "evidencia-2.png",
    );
  }

  const r = await fetch(`${BASE}/api/pagos/${ventaId}/disputa`, {
    method: "POST",
    headers: { "x-comprador-id": compradorId },
    body: fd,
  });
  return { status: r.status, cuerpo: await r.json().catch(() => null) };
}

async function responderDisputa(
  disputaId: string,
  token: string,
  datos: { respuesta: string; evidencias?: number },
): Promise<{ status: number; cuerpo: any }> {
  const fd = new FormData();
  fd.append("respuesta", datos.respuesta);

  const cantidad = datos.evidencias ?? 0;
  for (let indice = 0; indice < cantidad; indice++) {
    fd.append(
      "evidencias",
      new Blob([fs.readFileSync(rutaEvidencia1)], { type: "image/jpeg" }),
      "evidencia-1.jpg",
    );
  }

  const r = await fetch(`${BASE}/api/pagos/disputas/${disputaId}/responder`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });
  return { status: r.status, cuerpo: await r.json().catch(() => null) };
}

async function misDisputasComprador(compradorId: string): Promise<any[]> {
  const r = await fetch(`${BASE}/api/pagos/disputas/mis-disputas`, {
    headers: { "x-comprador-id": compradorId },
  });
  const datos = (await r.json().catch(() => null)) as {
    disputas?: any[];
  } | null;
  return datos?.disputas ?? [];
}

async function disputasVendedor(token: string): Promise<any[]> {
  const r = await fetch(`${BASE}/api/pagos/vendedor/disputas`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const datos = (await r.json().catch(() => null)) as {
    disputas?: any[];
  } | null;
  return datos?.disputas ?? [];
}

// --- BackOffice -------------------------------------------------------------

async function adminDisputas(
  token: string,
  consulta = "",
): Promise<{ status: number; cuerpo: any }> {
  const r = await fetch(`${BASE}/api/admin/disputas${consulta ? `?${consulta}` : ""}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return { status: r.status, cuerpo: await r.json().catch(() => null) };
}

async function resolverDisputaAdmin(
  disputaId: string,
  token: string,
  datos: { dictamen: string; nota?: string },
): Promise<{ status: number; cuerpo: any }> {
  const r = await fetch(`${BASE}/api/admin/disputas/${disputaId}/resolver`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(datos),
  });
  return { status: r.status, cuerpo: await r.json().catch(() => null) };
}

async function resolverVentaRetenida(
  idVenta: string | number,
  token: string,
  datos: { dictamen: string; causaAdeudo?: string; nota?: string },
): Promise<{ status: number; cuerpo: any }> {
  const r = await fetch(
    `${BASE}/api/admin/ventas-retenidas/${encodeURIComponent(String(idVenta))}/resolver`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(datos),
    },
  );
  return { status: r.status, cuerpo: await r.json().catch(() => null) };
}

async function adminAdeudos(
  token: string,
  consulta = "porPagina=50",
): Promise<{ status: number; cuerpo: any }> {
  const r = await fetch(`${BASE}/api/admin/adeudos?${consulta}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return { status: r.status, cuerpo: await r.json().catch(() => null) };
}

async function liquidarAdeudo(
  adeudoId: string,
  token: string,
  nota?: string,
): Promise<{ status: number; cuerpo: any }> {
  const r = await fetch(`${BASE}/api/admin/adeudos/${adeudoId}/liquidar`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(nota ? { nota } : {}),
  });
  return { status: r.status, cuerpo: await r.json().catch(() => null) };
}

// --- Reportes ---------------------------------------------------------------

async function crearReporte(
  compradorId: string,
  ventaId: number,
  categoria: string,
  detalle: string,
): Promise<{ status: number; cuerpo: any }> {
  const r = await fetch(`${BASE}/api/reportes`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-comprador-id": compradorId,
    },
    body: JSON.stringify({
      ventaId: String(ventaId),
      elemento: "producto",
      categoria,
      detalle,
    }),
  });
  return { status: r.status, cuerpo: await r.json().catch(() => null) };
}

async function resolverReporte(
  idReporte: number,
  token: string,
  resultado: "confirmado" | "rechazado",
): Promise<{ status: number; cuerpo: any }> {
  const r = await fetch(`${BASE}/api/admin/reportes/${idReporte}/resolver`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ resultado }),
  });
  return { status: r.status, cuerpo: await r.json().catch(() => null) };
}

async function leerReporteDeVenta(ventaId: number) {
  return clientePrisma.reporte.findFirst({
    where: { ventaId: String(ventaId) },
  });
}

// --- Acceso directo a PostgreSQL/MongoDB ------------------------------------
async function leerVenta(ventaId: number): Promise<any> {
  return clientePrisma.venta.findUnique({ where: { id: ventaId } });
}

async function actualizarVenta(ventaId: number, datos: Record<string, unknown>) {
  return clientePrisma.venta.update({ where: { id: ventaId }, data: datos });
}

async function leerEspejo(usuarioId: number) {
  return Usuario.findOne({ usuarioId }).lean();
}

// --- Suscripciones GraphQL --------------------------------------------------
const CONSULTA_DISPUTAS = `
  subscription {
    disputasActualizadas {
      tipo
      mensaje
      abiertas
      generadoEn
    }
  }
`;

function crearClienteDeSuscripciones(token: string): Client {
  return createClient({
    url: URL_WS,
    webSocketImpl: WebSocket,
    connectionParams: { Authorization: `Bearer ${token}` },
    retryAttempts: 0,
    lazy: false,
    onNonLazyError: () => {},
  });
}

/**
 * Se suscribe y espera el primer evento que cumpla el filtro; si se pasa un
 * disparador, lo ejecuta justo después de suscribirse (así ningún evento se
 * pierde).
 */
function esperarEvento<T>(
  cliente: Client,
  consulta: string,
  campo: string,
  filtro: (dato: T) => boolean,
  disparar?: () => Promise<unknown>,
  milisegundos = 15000,
): Promise<T> {
  return new Promise<T>((resolver, rechazar) => {
    let terminado = false;
    const temporizador = setTimeout(() => {
      if (terminado) return;
      terminado = true;
      rechazar(new Error("No llegó el evento esperado"));
    }, milisegundos);

    const cerrar = cliente.subscribe<Record<string, T>>(
      { query: consulta },
      {
        next: (resultado) => {
          const dato = resultado.data?.[campo];
          if (!terminado && dato && filtro(dato)) {
            terminado = true;
            clearTimeout(temporizador);
            cerrar();
            resolver(dato);
          }
        },
        error: (error) => {
          if (terminado) return;
          terminado = true;
          clearTimeout(temporizador);
          rechazar(
            error instanceof Error
              ? error
              : new Error(`Error de suscripción: ${JSON.stringify(error)}`),
          );
        },
        complete: () => {},
      },
    );

    if (disparar) {
      // Pequeña espera para que el marco `Subscribe` llegue al servidor antes
      // del disparador REST: el pub/sub no guarda historial de eventos.
      setTimeout(() => {
        disparar().catch((error) => {
          if (terminado) return;
          terminado = true;
          clearTimeout(temporizador);
          rechazar(error);
        });
      }, 400);
    }
  });
}

// ---------------------------------------------------------------------------
// Pruebas
// ---------------------------------------------------------------------------
const hijos: ChildProcess[] = [];
let clienteDeDisputas: Client | null = null;

try {
  console.log("Arrancando el backend de prueba…");
  const backend = arrancarBackend();
  hijos.push(backend);
  await esperarSalud(PUERTO_BACKEND);

  await mongoose.connect(process.env.MONGO_URI as string);

  // -------------------------------------------------------------------------
  // Preparación: dos vendedores (PayPal), un administrador y sus productos.
  // -------------------------------------------------------------------------
  const idV1 = await crearCuentaDePrueba({
    correo: CORREO_V1,
    nombreCompleto: "Vendedor Disputas Uno",
    tipo: "vendedor",
    rfc: `D1${marca}AAA`,
  });
  const idV2 = await crearCuentaDePrueba({
    correo: CORREO_V2,
    nombreCompleto: "Vendedor Disputas Dos",
    tipo: "vendedor",
    rfc: `D2${marca}BBB`,
  });
  await crearCuentaDePrueba({
    correo: CORREO_ADMIN,
    nombreCompleto: "Administrador Disputas",
    tipo: "admin",
    rfc: `DA${marca}CCC`,
  });

  const tokenV1 = await iniciarSesion(CORREO_V1, PASSWORD);
  const tokenV2 = await iniciarSesion(CORREO_V2, PASSWORD);
  const tokenAdmin = await iniciarSesion(CORREO_ADMIN, PASSWORD);
  verificar(
    "Cuentas de prueba disponibles (login por el espejo de MongoDB)",
    Boolean(tokenV1 && tokenV2 && tokenAdmin),
    "alguna cuenta no pudo iniciar sesión",
  );

  const creadoA = await crearProducto("Bicicleta urbana de disputas", tokenV1!, 250);
  const creadoB = await crearProducto("Radio antigua de disputas", tokenV1!, 210);
  const creadoE = await crearProducto("Cámara clásica de disputas", tokenV1!, 270);
  const creadoC = await crearProducto("Reloj artesanal de disputas", tokenV1!, 190);
  const creadoD = await crearProducto("Mochila de palma de disputas", tokenV1!, 230);
  const creadoR1 = await crearProducto("Guitarra de disputas", tokenV2!, 300);
  const creadoR2 = await crearProducto("Mesa plegable de disputas", tokenV2!, 150);
  const creadoR3 = await crearProducto("Lámpara de disputas", tokenV2!, 170);

  const pA = creadoA.producto;
  const pB = creadoB.producto;
  const pE = creadoE.producto;
  const pC = creadoC.producto;
  const pD = creadoD.producto;
  const pR1 = creadoR1.producto;
  const pR2 = creadoR2.producto;
  const pR3 = creadoR3.producto;

  verificar(
    "Productos de prueba creados con la moderación simulada",
    [pA, pB, pE, pC, pD, pR1, pR2, pR3].every(Boolean),
    `${productosCreados.length} de 8 productos`,
  );

  // =========================================================================
  // Suite 1 (pA): RQF40 + RQNF32 — disputa rechazada y liberación.
  // =========================================================================
  if (pA && tokenV1 && tokenAdmin) {
    const pasosA = await llevarAVentaEnEntrega(
      pA.id,
      COMPRADOR_A1,
      "ana.disputas@ejemplo.test",
      "REF-DIS-A1",
      tokenV1,
    );
    const ventaA = pasosA.compra.ventaId as number;
    await actualizarVenta(ventaA, { retenido: false });
    verificar(
      "RQF40 la compra en entrega queda lista para disputar",
      pasosA.comprobanteStatus === 200 &&
        pasosA.confirmacion.cuerpo?.estado === "en_entrega" &&
        (await leerVenta(ventaA))?.retenido === false,
      `comprobante=${pasosA.comprobanteStatus} confirmación=${JSON.stringify(pasosA.confirmacion.cuerpo)}`,
    );

    const disputaA = await abrirDisputa(ventaA, COMPRADOR_A1, {
      motivo: "El producto llegó con daños",
      descripcion:
        "La bicicleta tiene rayones profundos y la llanta trasera está ponchada.",
      evidencias: 2,
    });
    const disputaAId = String(disputaA.cuerpo?.disputa?.id ?? "");
    verificar(
      "RQF40 el comprador abre la disputa con motivo, descripción y evidencias",
      disputaA.status === 201 &&
        disputaA.cuerpo?.disputa?.estado === "abierta" &&
        disputaA.cuerpo?.disputa?.evidenciasComprador?.length === 2 &&
        Number(disputaA.cuerpo?.disputa?.ventaIdPg) === ventaA &&
        Number(disputaA.cuerpo?.disputa?.monto) === 250,
      `${disputaA.status}: ${JSON.stringify(disputaA.cuerpo).slice(0, 300)}`,
    );

    const ventaTrasDisputa = await leerVenta(ventaA);
    const espejoTrasDisputa = await Venta.findOne({
      paypalOrderId: pasosA.compra.orderId,
    }).lean();
    verificar(
      "RQNF32 la disputa retiene el pago en PostgreSQL y en el espejo",
      ventaTrasDisputa?.retenido === true && espejoTrasDisputa?.retenido === true,
      `pg=${ventaTrasDisputa?.retenido} mongo=${espejoTrasDisputa?.retenido}`,
    );

    const disputaDuplicada = await abrirDisputa(ventaA, COMPRADOR_A1, {
      motivo: "Otra disputa sobre la misma compra",
    });
    verificar(
      "RQF40 solo se admite una disputa abierta por compra",
      disputaDuplicada.status === 400 &&
        String(disputaDuplicada.cuerpo?.message ?? "").includes(
          "Ya tienes una disputa abierta",
        ),
      `${disputaDuplicada.status}: ${JSON.stringify(disputaDuplicada.cuerpo)}`,
    );

    const disputaAjena = await abrirDisputa(ventaA, COMPRADOR_B1, {
      motivo: "Quiero disputar una compra ajena",
    });
    verificar(
      "RQF40 solo el comprador de la compra puede abrir su disputa",
      disputaAjena.status === 403,
      `${disputaAjena.status}: ${JSON.stringify(disputaAjena.cuerpo)}`,
    );

    const entregaBloqueada = await confirmarEntrega(
      ventaA,
      tokenV1,
      String(pasosA.detalleCompra?.codigoEntrega ?? ""),
    );
    const ventaTrasBloqueo = await leerVenta(ventaA);
    verificar(
      "RQNF32 la retención preventiva bloquea la liberación del pago al vendedor",
      entregaBloqueada.status === 400 &&
        String(entregaBloqueada.cuerpo?.message ?? "").includes(
          "retención preventiva",
        ) &&
        ventaTrasBloqueo?.estado === "en_entrega",
      `${entregaBloqueada.status}: ${JSON.stringify(entregaBloqueada.cuerpo)}`,
    );

    const respuestaAjena = await responderDisputa(disputaAId, tokenV2!, {
      respuesta: "No soy el vendedor de esta venta",
    });
    verificar(
      "RQF40 solo el vendedor de la venta responde su disputa",
      respuestaAjena.status === 403,
      `${respuestaAjena.status}: ${JSON.stringify(respuestaAjena.cuerpo)}`,
    );

    const respuestaV1 = await responderDisputa(disputaAId, tokenV1, {
      respuesta:
        "La entregué sin daños en el punto acordado; adjunto la foto del estado al momento de la entrega.",
      evidencias: 1,
    });
    verificar(
      "RQF40 el vendedor responde con su versión y sus evidencias",
      respuestaV1.status === 200 &&
        Boolean(respuestaV1.cuerpo?.disputa?.respuestaVendedor) &&
        respuestaV1.cuerpo?.disputa?.evidenciasVendedor?.length === 1 &&
        Boolean(respuestaV1.cuerpo?.disputa?.respondidaEn),
      `${respuestaV1.status}: ${JSON.stringify(respuestaV1.cuerpo).slice(0, 300)}`,
    );

    const respuestaDoble = await responderDisputa(disputaAId, tokenV1, {
      respuesta: "Quiero responder otra vez",
    });
    verificar(
      "RQF40 el vendedor no puede responder dos veces la misma disputa",
      respuestaDoble.status === 400 &&
        String(respuestaDoble.cuerpo?.message ?? "").includes("Ya respondiste"),
      `${respuestaDoble.status}: ${JSON.stringify(respuestaDoble.cuerpo)}`,
    );

    const misDisputasA = await misDisputasComprador(COMPRADOR_A1);
    const disputaEnMisPedidos = misDisputasA.find(
      (candidata) => String(candidata.id) === disputaAId,
    );
    verificar(
      "RQF40 el comprador ve su disputa en Mis pedidos",
      disputaEnMisPedidos?.estado === "abierta" &&
        disputaEnMisPedidos?.ventaEstado === "en_entrega" &&
        String(disputaEnMisPedidos?.evidenciasComprador?.[0] ?? "").startsWith(
          "/api/pagos/disputas/",
        ),
      JSON.stringify(disputaEnMisPedidos ?? {}).slice(0, 300),
    );

    const disputasDeV1 = await disputasVendedor(tokenV1);
    verificar(
      "RQF40 el vendedor ve la disputa en su panel",
      disputasDeV1.some((candidata) => String(candidata.id) === disputaAId),
      `${disputasDeV1.length} disputas`,
    );

    const listadoAdmin = await adminDisputas(tokenAdmin);
    const disputaEnBackoffice = listadoAdmin.cuerpo?.disputas?.find(
      (candidata: any) => String(candidata.id) === disputaAId,
    );
    const retenidaA = listadoAdmin.cuerpo?.ventasRetenidas?.find(
      (candidata: any) => Number(candidata.ventaId) === ventaA,
    );
    verificar(
      "RQF40 el BackOffice lista la disputa y la venta retenida",
      listadoAdmin.status === 200 &&
        Boolean(disputaEnBackoffice) &&
        retenidaA?.tieneDisputaAbierta === true &&
        Number(listadoAdmin.cuerpo?.abiertas) >= 1,
      `status=${listadoAdmin.status} retenida=${JSON.stringify(retenidaA)}`,
    );

    const urlEvidencia = String(
      disputaA.cuerpo?.disputa?.evidenciasComprador?.[0] ?? "",
    );
    const evidenciaComprador = await fetch(`${BASE}${urlEvidencia}`, {
      headers: { "x-comprador-id": COMPRADOR_A1 },
    });
    const evidenciaCompradorAjeno = await fetch(`${BASE}${urlEvidencia}`, {
      headers: { "x-comprador-id": COMPRADOR_B1 },
    });
    const evidenciaVendedor = await fetch(`${BASE}${urlEvidencia}`, {
      headers: { Authorization: `Bearer ${tokenV1}` },
    });
    const evidenciaVendedorAjeno = await fetch(`${BASE}${urlEvidencia}`, {
      headers: { Authorization: `Bearer ${tokenV2}` },
    });
    const evidenciaAdmin = await fetch(`${BASE}${urlEvidencia}`, {
      headers: { Authorization: `Bearer ${tokenAdmin}` },
    });
    const evidenciaAnonima = await fetch(`${BASE}${urlEvidencia}`);
    verificar(
      "RQF40 las evidencias solo las ven el comprador, el vendedor y la administración",
      evidenciaComprador.status === 200 &&
        evidenciaVendedor.status === 200 &&
        evidenciaAdmin.status === 200 &&
        evidenciaCompradorAjeno.status === 403 &&
        evidenciaVendedorAjeno.status === 403 &&
        evidenciaAnonima.status === 403,
      `comprador=${evidenciaComprador.status} vendedor=${evidenciaVendedor.status} admin=${evidenciaAdmin.status} ajeno=${evidenciaCompradorAjeno.status} vendedorAjeno=${evidenciaVendedorAjeno.status} anónimo=${evidenciaAnonima.status}`,
    );

    const evidenciaInexistente = await fetch(
      `${BASE}${urlEvidencia.replace(/\/0$/, "/9")}`,
      { headers: { "x-comprador-id": COMPRADOR_A1 } },
    );
    verificar(
      "RQF40 una evidencia inexistente responde 404",
      evidenciaInexistente.status === 404,
      `status ${evidenciaInexistente.status}`,
    );

    const rechazoA = await resolverDisputaAdmin(disputaAId, tokenAdmin, {
      dictamen: "rechazar",
      nota: "Las fotos muestran el producto en buen estado al momento de la entrega",
    });
    verificar(
      "RQF40 el administrador rechaza la disputa y se retira la retención",
      rechazoA.status === 200 &&
        rechazoA.cuerpo?.dictamen === "rechazar" &&
        rechazoA.cuerpo?.retencionLiberada === true &&
        String(rechazoA.cuerpo?.message ?? "").includes("retiró la retención"),
      `${rechazoA.status}: ${JSON.stringify(rechazoA.cuerpo).slice(0, 300)}`,
    );

    const ventaLiberada = await leerVenta(ventaA);
    const espejoLiberado = await Venta.findOne({
      paypalOrderId: pasosA.compra.orderId,
    }).lean();
    verificar(
      "RQNF32 al rechazar la disputa la venta queda liberada en PostgreSQL y el espejo",
      ventaLiberada?.retenido === false && espejoLiberado?.retenido === false,
      `pg=${ventaLiberada?.retenido} mongo=${espejoLiberado?.retenido}`,
    );

    const rechazoDoble = await resolverDisputaAdmin(disputaAId, tokenAdmin, {
      dictamen: "rechazar",
    });
    verificar(
      "RQF40 una disputa resuelta ya no se puede resolver de nuevo",
      rechazoDoble.status === 400 &&
        String(rechazoDoble.cuerpo?.message ?? "").includes("ya fue resuelta"),
      `${rechazoDoble.status}: ${JSON.stringify(rechazoDoble.cuerpo)}`,
    );

    const respuestaTardia = await responderDisputa(disputaAId, tokenV1, {
      respuesta: "Respuesta después del dictamen",
    });
    verificar(
      "RQF40 una disputa resuelta ya no admite respuesta del vendedor",
      respuestaTardia.status === 400 &&
        String(respuestaTardia.cuerpo?.message ?? "").includes("ya fue resuelta"),
      `${respuestaTardia.status}: ${JSON.stringify(respuestaTardia.cuerpo)}`,
    );

    const entregaA = await confirmarEntrega(
      ventaA,
      tokenV1,
      String(pasosA.detalleCompra?.codigoEntrega ?? ""),
    );
    verificar(
      "RQF40 resuelta la disputa la venta continúa su flujo normal",
      entregaA.status === 200 &&
        entregaA.cuerpo?.estado === "completada" &&
        (await leerVenta(ventaA))?.estado === "completada",
      `${entregaA.status}: ${JSON.stringify(entregaA.cuerpo)}`,
    );

    const disputaNuevaA = await abrirDisputa(ventaA, COMPRADOR_A1, {
      motivo: "Quiero disputar la misma compra otra vez",
    });
    verificar(
      "RQF40 una compra ya disputada no admite otra disputa",
      disputaNuevaA.status === 400 &&
        String(disputaNuevaA.cuerpo?.message ?? "").includes(
          "ya tuvo una disputa resuelta",
        ),
      `${disputaNuevaA.status}: ${JSON.stringify(disputaNuevaA.cuerpo)}`,
    );

    const soloRechazadas = await adminDisputas(tokenAdmin, "estado=rechazada");
    verificar(
      "RQF40 el BackOffice filtra las disputas por estado",
      soloRechazadas.status === 200 &&
        soloRechazadas.cuerpo?.disputas?.some(
          (candidata: any) => String(candidata.id) === disputaAId,
        ),
      JSON.stringify(soloRechazadas.cuerpo).slice(0, 200),
    );
  }

  // =========================================================================
  // Suite 2 (pB): RQNF37 — disputa reembolsada, adeudo y suspensión.
  // =========================================================================
  if (pB && tokenV1 && tokenAdmin) {
    const pasosB = await llevarAVentaEnEntrega(
      pB.id,
      COMPRADOR_B1,
      "bruno.disputas@ejemplo.test",
      "REF-DIS-B1",
      tokenV1,
    );
    const ventaB = pasosB.compra.ventaId as number;
    const disputaB = await abrirDisputa(ventaB, COMPRADOR_B1, {
      motivo: "Nunca recibí el producto",
      descripcion:
        "Pasó la fecha acordada y el vendedor dejó de responder en el chat.",
      evidencias: 1,
    });
    const disputaBId = String(disputaB.cuerpo?.disputa?.id ?? "");
    verificar(
      "RQF40 la segunda disputa se abre sobre una venta en entrega",
      disputaB.status === 201 && disputaB.cuerpo?.disputa?.estado === "abierta",
      `${disputaB.status}: ${JSON.stringify(disputaB.cuerpo).slice(0, 200)}`,
    );

    const resolucionB = await resolverDisputaAdmin(disputaBId, tokenAdmin, {
      dictamen: "reembolsar",
      nota: "El vendedor no comprobó la entrega ni respondió en el chat",
    });
    verificar(
      "RQNF37 al reembolsar por culpa del vendedor se registra su adeudo",
      resolucionB.status === 200 &&
        resolucionB.cuerpo?.reembolsada === true &&
        Boolean(resolucionB.cuerpo?.adeudoId) &&
        String(resolucionB.cuerpo?.message ?? "").includes("adeudo"),
      `${resolucionB.status}: ${JSON.stringify(resolucionB.cuerpo).slice(0, 300)}`,
    );

    const ventaBTras = await leerVenta(ventaB);
    verificar(
      "RQNF27 el reembolso anula la autorización de PayPal de la venta en entrega",
      ventaBTras?.estado === "cancelada" &&
        ventaBTras?.retenido === false &&
        paypalMock.anulaciones.has(`AUTH-${pasosB.compra.orderId}`) &&
        String(ventaBTras?.canceladoMotivo ?? "").includes(
          "Disputa resuelta a favor",
        ),
      `estado=${ventaBTras?.estado} anulada=${paypalMock.anulaciones.has(`AUTH-${pasosB.compra.orderId}`)} motivo=${ventaBTras?.canceladoMotivo}`,
    );

    const adeudoB = await Adeudo.findById(resolucionB.cuerpo.adeudoId).lean();
    verificar(
      "RQNF37 el adeudo queda con la causa de la disputa y el monto reembolsado",
      adeudoB?.causa === "disputa_vendedor" &&
        adeudoB?.estado === "pendiente" &&
        Number(adeudoB?.monto) === 210 &&
        Number(adeudoB?.ventaIdPg) === ventaB &&
        Number(adeudoB?.usuarioId) === idV1,
      JSON.stringify(adeudoB ?? {}).slice(0, 300),
    );

    const espejoV1 = await leerEspejo(idV1);
    verificar(
      "RQNF37 la cuenta del vendedor queda suspendida con saldo pendiente",
      espejoV1?.suspendido === true &&
        espejoV1?.motivoSuspension === "saldo_pendiente" &&
        Number(espejoV1?.saldoPendiente) === 210,
      JSON.stringify({
        suspendido: espejoV1?.suspendido,
        motivo: espejoV1?.motivoSuspension,
        saldo: espejoV1?.saldoPendiente,
      }),
    );

    const loginSuspendido = await iniciarSesion(CORREO_V1, PASSWORD);
    verificar(
      "RQNF38 la suspensión por saldo permite iniciar sesión",
      Boolean(loginSuspendido),
      "el login del vendedor suspendido por saldo falló",
    );

    const publicarBloqueado = await crearProducto(
      "Producto bloqueado por saldo",
      tokenV1,
      100,
    );
    verificar(
      "RQNF38 el suspendido por saldo no puede publicar",
      publicarBloqueado.producto === null &&
        publicarBloqueado.status === 403 &&
        publicarBloqueado.mensaje.includes("saldo pendiente"),
      `status=${publicarBloqueado.status} mensaje=${publicarBloqueado.mensaje}`,
    );

    const listaAdeudos = await adminAdeudos(tokenAdmin);
    const adeudoEnLista = listaAdeudos.cuerpo?.adeudos?.find(
      (candidato: any) => String(candidato.id) === String(resolucionB.cuerpo.adeudoId),
    );
    verificar(
      "RQNF37 el BackOffice lista los adeudos con su vendedor",
      listaAdeudos.status === 200 &&
        Boolean(adeudoEnLista) &&
        String(adeudoEnLista?.vendedorNombre ?? "").includes("Disputas Uno") &&
        Number(listaAdeudos.cuerpo?.pendienteTotal) >= 210,
      `${listaAdeudos.status}: ${JSON.stringify(adeudoEnLista ?? {}).slice(0, 200)}`,
    );
  }

  // =========================================================================
  // Suite 3 (pE): RQNF37 — disputa de una compra completada (reembolso de la
  // captura) y acumulación del saldo.
  // =========================================================================
  if (pE && tokenV1 && tokenAdmin) {
    const pasosE = await llevarAVentaEnEntrega(
      pE.id,
      COMPRADOR_E1,
      "elena.disputas@ejemplo.test",
      "REF-DIS-E1",
      tokenV1,
    );
    const ventaE = pasosE.compra.ventaId as number;
    await actualizarVenta(ventaE, { retenido: false });
    const entregaE = await confirmarEntrega(
      ventaE,
      tokenV1,
      String(pasosE.detalleCompra?.codigoEntrega ?? ""),
    );
    const ventaECompletada = await leerVenta(ventaE);
    verificar(
      "RQNF27 la venta que se disputará completada se cierra con captura de PayPal",
      entregaE.status === 200 &&
        ventaECompletada?.estado === "completada" &&
        paypalMock.capturas.get(`AUTH-${pasosE.compra.orderId}`) ===
          ventaECompletada?.capturaPaypalId,
      `${entregaE.status}: captura=${ventaECompletada?.capturaPaypalId}`,
    );

    const disputaE = await abrirDisputa(ventaE, COMPRADOR_E1, {
      motivo: "El producto no es el anunciado",
      descripcion:
        "La cámara recibida es otro modelo y no enciende; adjunto fotografías.",
      evidencias: 2,
    });
    const disputaEId = String(disputaE.cuerpo?.disputa?.id ?? "");
    verificar(
      "RQF40 la disputa de una compra completada se abre con evidencias",
      disputaE.status === 201 &&
        disputaE.cuerpo?.disputa?.estado === "abierta" &&
        disputaE.cuerpo?.disputa?.ventaEstado === "completada",
      `${disputaE.status}: ${JSON.stringify(disputaE.cuerpo).slice(0, 200)}`,
    );

    const resolucionE = await resolverDisputaAdmin(disputaEId, tokenAdmin, {
      dictamen: "reembolsar",
      nota: "Las evidencias confirman que el producto no corresponde al anuncio",
    });
    verificar(
      "RQNF37 la disputa de una compra completada reembolsa y acumula el adeudo",
      resolucionE.status === 200 &&
        resolucionE.cuerpo?.reembolsada === true &&
        Boolean(resolucionE.cuerpo?.adeudoId),
      `${resolucionE.status}: ${JSON.stringify(resolucionE.cuerpo).slice(0, 300)}`,
    );

    const ventaETras = await leerVenta(ventaE);
    verificar(
      "RQNF27 PayPal reembolsa la captura de la venta completada",
      ventaETras?.estado === "reembolsada" &&
        String(ventaETras?.reembolsoId ?? "").startsWith("REF-") &&
        paypalMock.reembolsos >= 1,
      `estado=${ventaETras?.estado} reembolso=${ventaETras?.reembolsoId} reembolsos=${paypalMock.reembolsos}`,
    );

    const disputaEDoc = await Disputa.findById(disputaEId).lean();
    verificar(
      "RQF40 la disputa guarda el identificador del reembolso",
      Boolean(disputaEDoc?.reembolsoId),
      JSON.stringify(disputaEDoc ?? {}).slice(0, 200),
    );

    const espejoV1Acumulado = await leerEspejo(idV1);
    verificar(
      "RQNF37 los adeudos se acumulan en el saldo pendiente del vendedor",
      Number(espejoV1Acumulado?.saldoPendiente) === 210 + 270 &&
        espejoV1Acumulado?.suspendido === true,
      `saldo=${espejoV1Acumulado?.saldoPendiente}`,
    );
  }

  // =========================================================================
  // Suite 4 (pC): RQNF32 — reporte sobre una compra sin liberar (retención y
  // liberación al rechazarse) y RQNF38 (entregas en curso del suspendido).
  // =========================================================================
  if (pC && tokenV1 && tokenAdmin) {
    const compraC = await pagarConPaypal(
      pC.id,
      COMPRADOR_C1,
      "carla.disputas@ejemplo.test",
    );
    const ventaC = compraC.ventaId as number;
    await actualizarVenta(ventaC, { retenido: false });
    verificar(
      "RQNF32 la compra reportada parte sin retención preventiva",
      compraC.ok && (await leerVenta(ventaC))?.retenido === false,
      compraC.detalle,
    );

    const reporteC = await crearReporte(
      COMPRADOR_C1,
      ventaC,
      "falta_respeto",
      "El vendedor no responde los mensajes de coordinación",
    );
    const ventaCTrasReporte = await leerVenta(ventaC);
    verificar(
      "RQNF32 un reporte sobre una compra sin liberar retiene el pago",
      reporteC.status === 201 && ventaCTrasReporte?.retenido === true,
      `${reporteC.status}: retenido=${ventaCTrasReporte?.retenido}`,
    );

    const reporteCDoc = await leerReporteDeVenta(ventaC);
    const rechazoC = reporteCDoc
      ? await resolverReporte(Number(reporteCDoc.id), tokenAdmin, "rechazado")
      : { status: 0, cuerpo: null };
    verificar(
      "RQNF32 al rechazarse el reporte se retira la retención",
      rechazoC.status === 200 && (await leerVenta(ventaC))?.retenido === false,
      `${rechazoC.status}: retenido=${(await leerVenta(ventaC))?.retenido}`,
    );

    const comprobanteC = await subirComprobanteDeVenta(ventaC, COMPRADOR_C1, {
      palabraClave: String(compraC.codigoPago),
      referencia: "REF-DIS-C1",
    });
    const confirmacionC = await confirmarComprobante(ventaC, tokenV1);
    const detalleC = (await misCompras(COMPRADOR_C1)).find(
      (candidata) => candidata.ventaId === ventaC,
    );
    const entregaC = await confirmarEntrega(
      ventaC,
      tokenV1,
      String(detalleC?.codigoEntrega ?? ""),
    );
    verificar(
      "RQNF38 el suspendido por saldo puede terminar una entrega en curso",
      comprobanteC.status === 200 &&
        confirmacionC.cuerpo?.estado === "en_entrega" &&
        entregaC.status === 200 &&
        entregaC.cuerpo?.estado === "completada",
      `comprobante=${comprobanteC.status} confirmación=${JSON.stringify(confirmacionC.cuerpo)} entrega=${JSON.stringify(entregaC.cuerpo)}`,
    );
  }

  // =========================================================================
  // Suite 5 (pD): RQNF32 — venta retenida resuelta por el administrador con
  // el dictamen «liberar».
  // =========================================================================
  if (pD && tokenV1 && tokenAdmin) {
    const pasosD = await llevarAVentaEnEntrega(
      pD.id,
      COMPRADOR_D1,
      "diego.disputas@ejemplo.test",
      "REF-DIS-D1",
      tokenV1,
    );
    const ventaD = pasosD.compra.ventaId as number;

    const dictamenInvalidoD = await resolverVentaRetenida(ventaD, tokenAdmin, {
      dictamen: "otro",
    });
    verificar(
      "RQNF32 el dictamen de una venta retenida debe ser reembolsar o liberar",
      dictamenInvalidoD.status === 400,
      `${dictamenInvalidoD.status}: ${JSON.stringify(dictamenInvalidoD.cuerpo)}`,
    );

    const ventaDPre = await leerVenta(ventaD);
    const resolverD = await resolverVentaRetenida(ventaD, tokenAdmin, {
      dictamen: "liberar",
      nota: "Revisión administrativa: sin irregularidades pendientes",
    });
    verificar(
      "RQNF32 el administrador retira la retención de una venta retenida",
      ventaDPre?.retenido === true &&
        resolverD.status === 200 &&
        resolverD.cuerpo?.retencionLiberada === true &&
        (await leerVenta(ventaD))?.retenido === false,
      `${resolverD.status}: ${JSON.stringify(resolverD.cuerpo).slice(0, 200)}`,
    );

    const entregaD = await confirmarEntrega(
      ventaD,
      tokenV1,
      String(pasosD.detalleCompra?.codigoEntrega ?? ""),
    );
    verificar(
      "RQNF32 liberada la retención la venta puede completarse",
      entregaD.status === 200 && entregaD.cuerpo?.estado === "completada",
      `${entregaD.status}: ${JSON.stringify(entregaD.cuerpo)}`,
    );

    const resolverD2 = await resolverVentaRetenida(ventaD, tokenAdmin, {
      dictamen: "liberar",
    });
    verificar(
      "RQNF32 una venta sin retención pendiente no se puede resolver de nuevo",
      resolverD2.status === 400 &&
        String(resolverD2.cuerpo?.message ?? "").includes("no tiene una retención"),
      `${resolverD2.status}: ${JSON.stringify(resolverD2.cuerpo)}`,
    );
  }

  // =========================================================================
  // Suite 6 (pR1): RQNF37/RQNF38 — venta retenida reembolsada por la
  // administración (id del espejo de Mongo), adeudo y reactivación del
  // segundo vendedor.
  // =========================================================================
  if (pR1 && tokenV2 && tokenAdmin) {
    const pasosR1 = await llevarAVentaEnEntrega(
      pR1.id,
      COMPRADOR_R1,
      "rita.disputas@ejemplo.test",
      "REF-DIS-R1",
      tokenV2,
    );
    const ventaR1 = pasosR1.compra.ventaId as number;
    const espejoR1 = await Venta.findOne({
      paypalOrderId: pasosR1.compra.orderId,
    })
      .select("_id")
      .lean();

    const resolverR1 = await resolverVentaRetenida(
      String(espejoR1?._id ?? ""),
      tokenAdmin,
      {
        dictamen: "reembolsar",
        causaAdeudo: "reporte_confirmado",
        nota: "El reporte confirmado acreditó el incumplimiento del vendedor",
      },
    );
    verificar(
      "RQNF32 el administrador reembolsa una venta retenida (acepta el id del espejo)",
      resolverR1.status === 200 &&
        resolverR1.cuerpo?.reembolsada === true &&
        Boolean(resolverR1.cuerpo?.adeudoId) &&
        Number(resolverR1.cuerpo?.ventaId) === ventaR1,
      `${resolverR1.status}: ${JSON.stringify(resolverR1.cuerpo).slice(0, 300)}`,
    );

    const ventaR1Tras = await leerVenta(ventaR1);
    const adeudoR1 = await Adeudo.findById(resolverR1.cuerpo?.adeudoId).lean();
    verificar(
      "RQNF37 el reembolso administrativo registra el adeudo con la causa indicada",
      ventaR1Tras?.estado === "cancelada" &&
        ventaR1Tras?.retenido === false &&
        adeudoR1?.causa === "reporte_confirmado" &&
        adeudoR1?.estado === "pendiente" &&
        Number(adeudoR1?.monto) === 300 &&
        Number(adeudoR1?.usuarioId) === idV2,
      `estado=${ventaR1Tras?.estado} adeudo=${JSON.stringify(adeudoR1 ?? {}).slice(0, 200)}`,
    );

    const espejoV2 = await leerEspejo(idV2);
    verificar(
      "RQNF37 la suspensión por saldo llega al vendedor de la venta retenida",
      espejoV2?.suspendido === true &&
        espejoV2?.motivoSuspension === "saldo_pendiente" &&
        Number(espejoV2?.saldoPendiente) === 300,
      JSON.stringify({
        suspendido: espejoV2?.suspendido,
        saldo: espejoV2?.saldoPendiente,
      }),
    );

    const liquidarR1 = await liquidarAdeudo(
      String(resolverR1.cuerpo?.adeudoId ?? ""),
      tokenAdmin,
      "Transferencia recibida en la cuenta de la plataforma",
    );
    verificar(
      "RQNF38 al liquidar su adeudo el segundo vendedor se reactiva",
      liquidarR1.status === 200 &&
        liquidarR1.cuerpo?.reactivado === true &&
        Number(liquidarR1.cuerpo?.saldoPendiente) === 0,
      `${liquidarR1.status}: ${JSON.stringify(liquidarR1.cuerpo).slice(0, 200)}`,
    );

    const espejoV2Libre = await leerEspejo(idV2);
    verificar(
      "RQNF38 el espejo del segundo vendedor queda sin suspensión",
      espejoV2Libre?.suspendido === false &&
        espejoV2Libre?.motivoSuspension === null &&
        Number(espejoV2Libre?.saldoPendiente) === 0,
      JSON.stringify({
        suspendido: espejoV2Libre?.suspendido,
        motivo: espejoV2Libre?.motivoSuspension,
      }),
    );

    const liquidarR1Otra = await liquidarAdeudo(
      String(resolverR1.cuerpo?.adeudoId ?? ""),
      tokenAdmin,
    );
    verificar(
      "RQNF38 un adeudo ya liquidado no se puede liquidar de nuevo",
      liquidarR1Otra.status === 400 &&
        String(liquidarR1Otra.cuerpo?.message ?? "").includes("ya fue liquidado"),
      `${liquidarR1Otra.status}: ${JSON.stringify(liquidarR1Otra.cuerpo)}`,
    );

    const publicarV2 = await crearProducto(
      "Guitarra tras reactivación",
      tokenV2,
      120,
    );
    verificar(
      "RQNF38 el segundo vendedor reactivado puede publicar de nuevo",
      publicarV2.producto !== null,
      `status=${publicarV2.status} mensaje=${publicarV2.mensaje}`,
    );
  }

  // =========================================================================
  // Suite 7 (pR2): RQF40 — restricciones de las disputas (estados válidos e
  // identificadores).
  // =========================================================================
  if (pR2 && tokenV2 && tokenAdmin) {
    const compraR2 = await pagarConPaypal(
      pR2.id,
      COMPRADOR_R2,
      "rosa.disputas@ejemplo.test",
    );
    const ventaR2 = compraR2.ventaId as number;
    await actualizarVenta(ventaR2, { retenido: false });

    const disputaR2 = await abrirDisputa(ventaR2, COMPRADOR_R2, {
      motivo: "Quiero disputar antes de confirmar el pago",
    });
    verificar(
      "RQF40 no se puede disputar una compra sin pago confirmado",
      disputaR2.status === 400 &&
        String(disputaR2.cuerpo?.message ?? "").includes(
          "en entrega o ya fue completada",
        ),
      `${disputaR2.status}: ${JSON.stringify(disputaR2.cuerpo)}`,
    );

    const disputaFantasma = await abrirDisputa(999999999, COMPRADOR_R2, {
      motivo: "Compra inexistente",
    });
    verificar(
      "RQF40 una compra inexistente no admite disputa",
      disputaFantasma.status === 404,
      `${disputaFantasma.status}: ${JSON.stringify(disputaFantasma.cuerpo)}`,
    );

    const resolverNoRetenida = await resolverVentaRetenida(ventaR2, tokenAdmin, {
      dictamen: "liberar",
    });
    verificar(
      "RQNF32 una venta sin retención no se puede resolver como retenida",
      resolverNoRetenida.status === 400 &&
        String(resolverNoRetenida.cuerpo?.message ?? "").includes(
          "no tiene una retención",
        ),
      `${resolverNoRetenida.status}: ${JSON.stringify(resolverNoRetenida.cuerpo)}`,
    );

    const resolverFantasma = await resolverDisputaAdmin("no-es-id", tokenAdmin, {
      dictamen: "rechazar",
    });
    verificar(
      "RQF40 el dictamen de una disputa necesita un identificador válido",
      resolverFantasma.status === 400,
      `${resolverFantasma.status}: ${JSON.stringify(resolverFantasma.cuerpo)}`,
    );
  }

  // =========================================================================
  // Suite 8 (pR3): RQF40/RQNF32 — disputa con venta retenida (interacción) y
  // la suscripción GraphQL `disputasActualizadas`.
  // =========================================================================
  if (pR3 && tokenV2 && tokenAdmin) {
    const pasosR3 = await llevarAVentaEnEntrega(
      pR3.id,
      COMPRADOR_R3,
      "raquel.disputas@ejemplo.test",
      "REF-DIS-R3",
      tokenV2,
    );
    const ventaR3 = pasosR3.compra.ventaId as number;
    await actualizarVenta(ventaR3, { retenido: false });

    const disputaSinMotivo = await abrirDisputa(ventaR3, COMPRADOR_R3, {
      motivo: "",
    });
    verificar(
      "RQF40 la disputa necesita un motivo",
      disputaSinMotivo.status === 400 &&
        String(disputaSinMotivo.cuerpo?.message ?? "").includes(
          "Indica el motivo",
        ),
      `${disputaSinMotivo.status}: ${JSON.stringify(disputaSinMotivo.cuerpo)}`,
    );

    clienteDeDisputas = crearClienteDeSuscripciones(tokenAdmin);
    let respuestaG: any = null;
    let eventoG: {
      tipo?: string;
      mensaje?: string;
      abiertas?: number;
    } | null = null;
    try {
      eventoG = await esperarEvento(
        clienteDeDisputas,
        CONSULTA_DISPUTAS,
        "disputasActualizadas",
        (dato: { tipo?: string }) => dato.tipo === "abierta",
        async () => {
          respuestaG = await abrirDisputa(ventaR3, COMPRADOR_R3, {
            motivo: "Producto incompleto",
            descripcion: "Falta un accesorio indispensable para usarlo.",
            evidencias: 1,
          });
        },
      );
    } catch (error) {
      eventoG = null;
      console.error(
        "[disputas] La suscripción disputasActualizadas no emitió:",
        error instanceof Error ? error.message : error,
      );
    }
    verificar(
      "RQF40 la suscripción disputasActualizadas avisa al BackOffice",
      eventoG?.tipo === "abierta" &&
        Number(eventoG?.abiertas) >= 1 &&
        String(eventoG?.mensaje ?? "").includes("disputa") &&
        respuestaG?.status === 201,
      `evento=${JSON.stringify(eventoG)} respuesta=${JSON.stringify(respuestaG)?.slice(0, 200)}`,
    );

    const disputaR3Id = String(respuestaG?.cuerpo?.disputa?.id ?? "");
    const resolverRetenidaG = await resolverVentaRetenida(ventaR3, tokenAdmin, {
      dictamen: "liberar",
    });
    verificar(
      "RQNF32 una venta con disputa abierta se resuelve desde la sección de disputas",
      resolverRetenidaG.status === 400 &&
        String(resolverRetenidaG.cuerpo?.message ?? "").includes(
          "disputa abierta",
        ),
      `${resolverRetenidaG.status}: ${JSON.stringify(resolverRetenidaG.cuerpo)}`,
    );

    const rechazoG = await resolverDisputaAdmin(disputaR3Id, tokenAdmin, {
      dictamen: "rechazar",
      nota: "El vendedor comprobó la entrega completa",
    });
    verificar(
      "RQF40 al rechazar la disputa se libera la retención de la venta",
      rechazoG.status === 200 &&
        rechazoG.cuerpo?.retencionLiberada === true &&
        (await leerVenta(ventaR3))?.retenido === false,
      `${rechazoG.status}: ${JSON.stringify(rechazoG.cuerpo).slice(0, 200)}`,
    );
  }

  // =========================================================================
  // Suite 9: RQNF38 — liquidación total de los adeudos del primer vendedor y
  // su reactivación (el saldo se acumuló con las suites 2 y 3).
  // =========================================================================
  if (tokenAdmin) {
    const adeudosV1 = await Adeudo.find({ usuarioId: idV1, estado: "pendiente" })
      .sort({ createdAt: 1 })
      .lean();
    verificar(
      "RQNF38 el primer vendedor acumula dos adeudos pendientes",
      adeudosV1.length === 2,
      `adeudos=${adeudosV1.length}`,
    );

    const liquidar1 = await liquidarAdeudo(
      String(adeudosV1[0]?._id ?? ""),
      tokenAdmin,
      "Transferencia parcial 1",
    );
    const espejoConSaldo = await leerEspejo(idV1);
    verificar(
      "RQNF38 con saldo restante la suspensión por saldo continúa",
      liquidar1.status === 200 &&
        liquidar1.cuerpo?.reactivado === false &&
        Number(liquidar1.cuerpo?.saldoPendiente) > 0 &&
        espejoConSaldo?.suspendido === true,
      `${liquidar1.status}: ${JSON.stringify(liquidar1.cuerpo).slice(0, 200)}`,
    );

    const liquidar2 = await liquidarAdeudo(
      String(adeudosV1[1]?._id ?? ""),
      tokenAdmin,
      "Transferencia parcial 2",
    );
    const espejoV1Libre = await leerEspejo(idV1);
    verificar(
      "RQNF38 al liquidar el último adeudo la cuenta se reactiva",
      liquidar2.status === 200 &&
        liquidar2.cuerpo?.reactivado === true &&
        Number(liquidar2.cuerpo?.saldoPendiente) === 0 &&
        espejoV1Libre?.suspendido === false,
      `${liquidar2.status}: ${JSON.stringify(liquidar2.cuerpo).slice(0, 200)}`,
    );

    verificar(
      "RQNF38 el espejo del primer vendedor queda sin suspensión",
      espejoV1Libre?.motivoSuspension === null &&
        Number(espejoV1Libre?.saldoPendiente) === 0,
      JSON.stringify({
        motivo: espejoV1Libre?.motivoSuspension,
        saldo: espejoV1Libre?.saldoPendiente,
      }),
    );

    const publicarV1 = await crearProducto(
      "Producto tras reactivación",
      tokenV1!,
      140,
    );
    verificar(
      "RQNF38 el vendedor reactivado puede publicar de nuevo",
      publicarV1.producto !== null,
      `status=${publicarV1.status} mensaje=${publicarV1.mensaje}`,
    );
  }
} finally {
  // -------------------------------------------------------------------------
  // Limpieza: disputas (y sus evidencias), adeudos, reportes, sanciones,
  // comprobantes, filas y ventas de prueba en PostgreSQL, espejos y
  // productos en MongoDB, cuentas de prueba y todos los procesos/mocks.
  // -------------------------------------------------------------------------
  if (clienteDeDisputas) {
    try {
      await clienteDeDisputas.dispose();
    } catch {
      /* ignorar */
    }
  }

  try {
    if (ventasCreadas.size > 0) {
      const disputas = await Disputa.find({
        ventaIdPg: { $in: [...ventasCreadas] },
      }).lean();
      for (const disputa of disputas) {
        const rutas = [
          ...((disputa.evidenciasComprador as string[] | undefined) ?? []),
          ...((disputa.evidenciasVendedor as string[] | undefined) ?? []),
        ];
        for (const ruta of rutas) {
          const rutaAbsoluta = path.join(RAIZ, String(ruta).replace(/^\//, ""));
          if (fs.existsSync(rutaAbsoluta)) fs.unlinkSync(rutaAbsoluta);
        }
      }
      await Disputa.deleteMany({ ventaIdPg: { $in: [...ventasCreadas] } });
      await Adeudo.deleteMany({ ventaIdPg: { $in: [...ventasCreadas] } });
    }
  } catch (error) {
    console.error("[limpieza] No se pudieron borrar disputas/adeudos:", error);
  }

  try {
    for (const idCuenta of idsCuentas) {
      await clientePrisma.reporte.deleteMany({ where: { vendedorId: idCuenta } });
    }
    await Sancion.deleteMany({ sujetoId: { $in: idsCuentas.map(String) } });
  } catch (error) {
    console.error("[limpieza] No se pudieron borrar reportes/sanciones:", error);
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
  `\nSuite de disputas: ${resultados.length - fallas.length}/${resultados.length} pruebas pasaron`,
);
if (fallas.length > 0) {
  console.log("Fallas:");
  for (const falla of fallas) console.log(` - ${falla.nombre}: ${falla.detalle}`);
  process.exit(1);
}
process.exit(0);
