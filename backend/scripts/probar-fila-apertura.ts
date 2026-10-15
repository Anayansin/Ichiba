/**
 * Pruebas de RQNF15 (productos siempre visibles; fila solo dentro del bloque
 * de atención), RQNF16 (aviso del bloque de atención en el turno de pago),
 * RQF18 (elegir "pagar ahora" o "esperar a la próxima apertura") y RQNF18
 * (la fila conserva su lugar y su reloj se pausa hasta la reapertura).
 *
 * Cubre:
 *  1. RQNF15: un vendedor sin horarios definidos está disponible siempre; con
 *     horarios, fuera del bloque el producto sigue visible pero no se puede
 *     entrar a la fila y se muestra la próxima apertura.
 *  2. RQNF16: en su turno, si al bloque vigente le quedan menos minutos que
 *     el límite de pago, el comprador recibe el aviso antes de pagar.
 *  3. RQF18: en su turno el comprador elige entre "pagar ahora" (sin atención
 *     ni chat hasta la próxima apertura) o "esperar conservando su lugar";
 *     solo la posición 1 puede elegir y una fila en espera no puede pagar.
 *  4. RQNF18: al abrir el siguiente bloque la fila se reanuda conservando su
 *     lugar y su reloj de pago; si libera el turno, la siguiente persona
 *     avanza con su propio reloj.
 *  5. Casos unitarios de `evaluarAtencionDelVendedor` con fechas fijas
 *     (martes 10 de marzo de 2026, 10:00 en la zona centro).
 *
 * Levanta un backend de prueba en el puerto 5104 con mocks locales de PayPal
 * (solo creación de órdenes) y Cloud Vision, y usa directamente
 * PostgreSQL/MongoDB locales (mismos que el backend de desarrollo).
 *
 * Uso (con MongoDB y PostgreSQL locales corriendo):
 *   node --harmony-temporal --import tsx scripts/probar-fila-apertura.ts
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
import { Usuario } from "../src/models/usuario.js";
import {
  evaluarAtencionDelVendedor,
  estaAtendiendo,
  obtenerTextoDeLaSiguienteApertura,
  relojZonaCentro,
  type BloqueHorario,
} from "../src/utils/validarHorario.js";
import { reactivarFilasEnEsperaDeApertura } from "../src/services/filaService.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(__dirname, "..");

const PUERTO_BACKEND = 5104;
const PUERTO_MOCK_PAYPAL = 59097;
const PUERTO_MOCK_VISION = 59100;
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
const PASSWORD = "FilaAperturaIchiba123!";

const CORREO_VENDEDOR = `vendedor.fila.${marca}@ichiba.test`;
const CORREO_PAYPAL = `paypal.fila.${marca}@ejemplo.test`;

const COMPRADOR_A = `comprador-fila-a-${marca}`;
const COMPRADOR_B = `comprador-fila-b-${marca}`;
const COMPRADOR_C = `comprador-fila-c-${marca}`;

// ---------------------------------------------------------------------------
// Mock de PayPal (solo lo necesario para crear la orden de pago)
// ---------------------------------------------------------------------------
type OrdenPaypalMock = {
  id: string;
  productoId: string;
  monto: string;
};

const paypalMock = {
  secuencia: 0,
  ordenes: new Map<string, OrdenPaypalMock>(),
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
    paypalMock.ordenes.set(id, {
      id,
      productoId: String(unidad?.reference_id ?? ""),
      monto: String(unidad?.amount?.value ?? ""),
    });

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

  responder(res, 404, { name: "RESOURCE_NOT_FOUND" });
});

// ---------------------------------------------------------------------------
// Mock de Cloud Vision (moderación de la imagen del producto)
// ---------------------------------------------------------------------------
const servidorVision = http.createServer((req, res) => {
  if ((req.method ?? "GET") !== "POST") {
    res.writeHead(404);
    return res.end();
  }
  responder(res, 200, {
    responses: [
      {
        labelAnnotations: [],
        safeSearchAnnotation: {
          adult: "VERY_UNLIKELY",
          spoof: "VERY_UNLIKELY",
          violence: "VERY_UNLIKELY",
          racy: "VERY_UNLIKELY",
        },
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
// Imagen de prueba del producto
// ---------------------------------------------------------------------------
const carpetaPruebas = path.join(RAIZ, "uploads", "pruebas-fila-apertura");
fs.mkdirSync(carpetaPruebas, { recursive: true });
const rutaFotoProducto = path.join(carpetaPruebas, "producto.jpg");

await sharp({
  create: {
    width: 600,
    height: 700,
    channels: 3,
    background: { r: 215, g: 220, b: 235 },
  },
})
  .jpeg()
  .toFile(rutaFotoProducto);

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
const idsCuentas: number[] = [];
const correosCuentas: string[] = [];

async function mensajeDe(r: Response): Promise<string> {
  try {
    const j = (await r.json()) as { message?: string };
    return j.message ?? JSON.stringify(j);
  } catch {
    return "(sin JSON)";
  }
}

/**
 * Crea una cuenta de vendedor de prueba directamente en PostgreSQL y su
 * espejo en MongoDB (la autenticación lee el espejo, así que la contraseña
 * va con hash bcryptjs real).
 */
async function crearCuentaDePrueba(opciones: {
  correo: string;
  nombreCompleto: string;
  horarios: BloqueHorario[];
}): Promise<number> {
  const passwordHasheada = await bcrypt.hash(PASSWORD, 10);
  const horarioConfirmadoEn = new Date();

  const creado = await clientePrisma.usuario.create({
    data: {
      nombreCompleto: opciones.nombreCompleto,
      direccion: "Av. de la Fila 100, Centro, Ciudad de México",
      telefono: "5599999999",
      correo: opciones.correo,
      rfc: `FA${marca}XYZ`,
      password: passwordHasheada,
      tipo: "vendedor",
      correoVerificado: true,
      ineFrente: "/uploads/ine/prueba-frente.jpg",
      ineReverso: "/uploads/ine/prueba-reverso.jpg",
      aceptaTerminos: true,
      recibirNotificacionesCriticas: true,
      recibirNotificacionesPublicitarias: false,
      paypalEmail: CORREO_PAYPAL,
      horarios: opciones.horarios,
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
        direccion: "Av. de la Fila 100, Centro, Ciudad de México",
        telefono: "5599999999",
        correo: opciones.correo,
        rfc: `FA${marca}XYZ`,
        password: passwordHasheada,
        tipo: "vendedor",
        correoVerificado: true,
        ineFrente: "/uploads/ine/prueba-frente.jpg",
        ineReverso: "/uploads/ine/prueba-reverso.jpg",
        aceptaTerminos: true,
        recibirNotificacionesCriticas: true,
        recibirNotificacionesPublicitarias: false,
        metodoPago: "paypal",
        datosMetodoPago: CORREO_PAYPAL,
        horarios: opciones.horarios,
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

/** Cambia los horarios del vendedor en PostgreSQL y en su espejo de Mongo. */
async function fijarHorariosDeVendedor(
  correo: string,
  horarios: BloqueHorario[],
): Promise<void> {
  await clientePrisma.usuario.updateMany({
    where: { correo },
    data: { horarios },
  });
  await Usuario.updateOne({ correo }, { $set: { horarios } });
}

function cuerpoProducto(cambios: Record<string, string> = {}): FormData {
  const base: Record<string, string> = {
    nombre: "Artículo de prueba de la fila virtual",
    precio: "120",
    descripcion:
      "Producto de prueba para la fila virtual y los bloques de atención.",
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
  const cuerpo = (await r.json().catch(() => null)) as {
    _id?: string;
    imagenes?: string[];
  } | null;
  if (!r.ok || !cuerpo?._id) return null;
  const producto: ProductoCreado = {
    id: cuerpo._id,
    nombre,
    token,
    imagenes: cuerpo.imagenes ?? [],
  };
  productosCreados.push(producto);
  return producto;
}

async function entrarAFila(
  productoId: string,
  compradorId: string,
  correo: string,
): Promise<{ status: number; cuerpo: any }> {
  const r = await fetch(`${BASE}/api/colas/entrar`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-comprador-id": compradorId,
    },
    body: JSON.stringify({ productoId, correo }),
  });
  return { status: r.status, cuerpo: await r.json().catch(() => null) };
}

async function estadoDeFila(
  productoId: string,
  compradorId: string,
): Promise<{ status: number; cuerpo: any }> {
  const r = await fetch(`${BASE}/api/colas/producto/${productoId}/estado`, {
    headers: { "x-comprador-id": compradorId },
  });
  return { status: r.status, cuerpo: await r.json().catch(() => null) };
}

async function esperarApertura(
  filaId: number,
  compradorId: string,
): Promise<{ status: number; cuerpo: any }> {
  const r = await fetch(`${BASE}/api/colas/${filaId}/esperar-apertura`, {
    method: "PATCH",
    headers: { "x-comprador-id": compradorId },
  });
  return { status: r.status, cuerpo: await r.json().catch(() => null) };
}

async function salirDeFila(
  filaId: number,
  compradorId: string,
): Promise<{ status: number; cuerpo: any }> {
  const r = await fetch(`${BASE}/api/colas/${filaId}/salir`, {
    method: "PATCH",
    headers: { "x-comprador-id": compradorId },
  });
  return { status: r.status, cuerpo: await r.json().catch(() => null) };
}

async function misFilas(compradorId: string): Promise<any[]> {
  const r = await fetch(`${BASE}/api/colas/mias`, {
    headers: { "x-comprador-id": compradorId },
  });
  const datos = await r.json().catch(() => null);
  return Array.isArray(datos) ? datos : [];
}

async function crearOrden(
  productoId: string,
  compradorId: string,
): Promise<{ status: number; cuerpo: any }> {
  const r = await fetch(`${BASE}/api/pagos/crear-orden`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-comprador-id": compradorId,
    },
    body: JSON.stringify({ productoId }),
  });
  return { status: r.status, cuerpo: await r.json().catch(() => null) };
}

function leerFila(filaId: number) {
  return clientePrisma.cola.findUnique({ where: { id: filaId } });
}

// ---------------------------------------------------------------------------
// Horarios de prueba
// ---------------------------------------------------------------------------
const NOMBRES_DE_DIA = [
  "domingo",
  "lunes",
  "martes",
  "miercoles",
  "jueves",
  "viernes",
  "sabado",
] as const;

/** Martes 10 de marzo de 2026 a las 10:00 en la zona centro (GMT-6). */
const FECHA_FIJA = new Date("2026-03-10T16:00:00Z");

const HORARIO_AMPLIO: BloqueHorario[] = NOMBRES_DE_DIA.map((dia) => ({
  dia,
  activo: true,
  horaInicio: "09:00",
  horaFin: "18:00",
}));

const HORARIO_CORTO: BloqueHorario[] = NOMBRES_DE_DIA.map((dia) => ({
  dia,
  activo: true,
  horaInicio: "09:00",
  horaFin: "10:30",
}));

const HORARIO_MAS_TARDE: BloqueHorario[] = NOMBRES_DE_DIA.map((dia) => ({
  dia,
  activo: true,
  horaInicio: "15:00",
  horaFin: "18:00",
}));

const HORARIO_MARTES_INACTIVO: BloqueHorario[] = NOMBRES_DE_DIA.map((dia) => ({
  dia,
  activo: dia !== "martes",
  horaInicio: "00:00",
  horaFin: "23:59",
}));

/** Horario con el día actual (GMT-6) inactivo y el resto siempre abierto. */
function horariosConHoyInactivo(): BloqueHorario[] {
  const reloj = relojZonaCentro(new Date());
  const hoy = NOMBRES_DE_DIA[reloj.getDay()];
  return NOMBRES_DE_DIA.map((dia) => ({
    dia,
    activo: dia !== hoy,
    horaInicio: "00:00",
    horaFin: "23:59",
  }));
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

  // =========================================================================
  // Suite 1: casos unitarios de evaluarAtencionDelVendedor (RQNF15 / RQNF16 /
  // RQF18) con fecha fija.
  // =========================================================================
  const sinHorarios = evaluarAtencionDelVendedor([], FECHA_FIJA, 60);
  verificar(
    "RQNF15 un vendedor sin horarios se considera disponible siempre",
    sinHorarios.atendiendo === true &&
      sinHorarios.minutosRestantesBloque === null &&
      sinHorarios.puedeEsperarApertura === false &&
      sinHorarios.avisoAtencion === null &&
      sinHorarios.siguienteApertura === null,
    JSON.stringify(sinHorarios),
  );

  const sinHorariosNulos = evaluarAtencionDelVendedor(null, FECHA_FIJA, 60);
  verificar(
    "RQNF15 sin horarios (null) también se considera disponible siempre",
    sinHorariosNulos.atendiendo === true &&
      sinHorariosNulos.puedeEsperarApertura === false,
    JSON.stringify(sinHorariosNulos),
  );

  const amplio = evaluarAtencionDelVendedor(HORARIO_AMPLIO, FECHA_FIJA, 60);
  verificar(
    "RQNF16 dentro del bloque y con tiempo de sobra no hay aviso ni espera",
    amplio.atendiendo === true &&
      amplio.minutosRestantesBloque === 480 &&
      amplio.puedeEsperarApertura === false &&
      amplio.avisoAtencion === null &&
      amplio.siguienteApertura === "mañana de 09:00 a 18:00",
    JSON.stringify(amplio),
  );

  const corto = evaluarAtencionDelVendedor(HORARIO_CORTO, FECHA_FIJA, 60);
  verificar(
    "RQNF16/RQF18 si al bloque le quedan menos minutos que el límite de pago se avisa y se puede esperar",
    corto.atendiendo === true &&
      corto.minutosRestantesBloque === 30 &&
      corto.puedeEsperarApertura === true &&
      String(corto.avisoAtencion).includes("30 minutos") &&
      String(corto.avisoAtencion).includes("mañana de 09:00 a 10:30") &&
      corto.siguienteApertura === "mañana de 09:00 a 10:30",
    JSON.stringify(corto),
  );

  const masTarde = evaluarAtencionDelVendedor(HORARIO_MAS_TARDE, FECHA_FIJA, 60);
  verificar(
    "RQNF15/RQF18 con el bloque de hoy aún por comenzar se ofrece esperar a la apertura de hoy",
    masTarde.atendiendo === false &&
      masTarde.puedeEsperarApertura === true &&
      masTarde.siguienteApertura === "hoy de 15:00 a 18:00",
    JSON.stringify(masTarde),
  );

  const inactivo = evaluarAtencionDelVendedor(
    HORARIO_MARTES_INACTIVO,
    FECHA_FIJA,
    60,
  );
  verificar(
    "RQNF15 fuera del bloque se avisa la próxima apertura y se ofrece esperar",
    inactivo.atendiendo === false &&
      inactivo.minutosRestantesBloque === null &&
      inactivo.puedeEsperarApertura === true &&
      String(inactivo.avisoAtencion).includes("no está en horario de atención") &&
      inactivo.siguienteApertura === "mañana de 00:00 a 23:59",
    JSON.stringify(inactivo),
  );

  verificar(
    "RQNF15 estaAtendiendo distingue sin horarios, dentro y fuera del bloque",
    estaAtendiendo([], FECHA_FIJA) === true &&
      estaAtendiendo(HORARIO_AMPLIO, FECHA_FIJA) === true &&
      estaAtendiendo(HORARIO_MARTES_INACTIVO, FECHA_FIJA) === false,
    "",
  );

  verificar(
    "RQF18 la siguiente apertura con el bloque vigente activo apunta al siguiente bloque",
    obtenerTextoDeLaSiguienteApertura(HORARIO_AMPLIO, FECHA_FIJA) ===
      "mañana de 09:00 a 18:00" &&
      obtenerTextoDeLaSiguienteApertura([], FECHA_FIJA) === null,
    String(obtenerTextoDeLaSiguienteApertura(HORARIO_AMPLIO, FECHA_FIJA)),
  );

  // =========================================================================
  // Suite 2 (E2E): fila virtual, aviso de atención y espera a la apertura.
  // =========================================================================
  const idVendedor = await crearCuentaDePrueba({
    correo: CORREO_VENDEDOR,
    nombreCompleto: "Vendedor Fila Apertura",
    horarios: [],
  });
  const tokenVendedor = await iniciarSesion(CORREO_VENDEDOR, PASSWORD);
  verificar(
    "Cuenta de prueba del vendedor disponible (login por el espejo de MongoDB)",
    Boolean(tokenVendedor && idVendedor),
    "no se pudo iniciar sesión",
  );

  const producto = tokenVendedor
    ? await crearProducto("Lámpara de la fila virtual", tokenVendedor, 120)
    : null;
  verificar(
    "Producto de prueba creado con la moderación simulada",
    producto !== null,
    "no se pudo crear el producto",
  );

  if (producto && tokenVendedor) {
    const filaA = await entrarAFila(
      producto.id,
      COMPRADOR_A,
      "ana.fila@ejemplo.test",
    );
    verificar(
      "RQNF15 con el vendedor siempre disponible el comprador entra en la posición 1 con su reloj",
      filaA.status === 201 &&
        Number(filaA.cuerpo?.posicion) === 1 &&
        Boolean(filaA.cuerpo?.pagoExpiraEn),
      `${filaA.status}: ${JSON.stringify(filaA.cuerpo)}`,
    );
    const idFilaA = Number(filaA.cuerpo?.id ?? 0);

    const filaB = await entrarAFila(
      producto.id,
      COMPRADOR_B,
      "bruno.fila@ejemplo.test",
    );
    verificar(
      "RQNF18 la segunda persona entra detrás sin reloj de pago",
      filaB.status === 201 &&
        Number(filaB.cuerpo?.posicion) === 2 &&
        !filaB.cuerpo?.pagoExpiraEn,
      `${filaB.status}: ${JSON.stringify(filaB.cuerpo)}`,
    );
    const idFilaB = Number(filaB.cuerpo?.id ?? 0);

    const estadoA1 = await estadoDeFila(producto.id, COMPRADOR_A);
    verificar(
      "RQNF16 en su turno, con el vendedor atendiendo, no hay aviso ni opción de esperar",
      estadoA1.status === 200 &&
        Number(estadoA1.cuerpo?.posicion) === 1 &&
        estadoA1.cuerpo?.puedePagar === true &&
        estadoA1.cuerpo?.horarioActivo === true &&
        estadoA1.cuerpo?.avisoAtencion === null &&
        estadoA1.cuerpo?.puedeElegirEspera === false &&
        estadoA1.cuerpo?.esperandoApertura === false &&
        Boolean(estadoA1.cuerpo?.pagoExpiraEn),
      `${estadoA1.status}: ${JSON.stringify(estadoA1.cuerpo)}`,
    );

    const estadoB1 = await estadoDeFila(producto.id, COMPRADOR_B);
    verificar(
      "RQF18 solo la posición 1 puede elegir esperar la próxima apertura",
      estadoB1.status === 200 &&
        Number(estadoB1.cuerpo?.posicion) === 2 &&
        estadoB1.cuerpo?.puedeElegirEspera === false &&
        estadoB1.cuerpo?.horarioActivo === true,
      `${estadoB1.status}: ${JSON.stringify(estadoB1.cuerpo)}`,
    );

    const estadoInexistente = await estadoDeFila(
      "000000000000000000000000",
      COMPRADOR_A,
    );
    verificar(
      "RQNF15 el estado de un producto inexistente responde 404",
      estadoInexistente.status === 404,
      `status ${estadoInexistente.status}`,
    );

    // El vendedor cierra su bloque de hoy: el producto sigue visible, pero la
    // fila queda inhabilitada hasta su próxima apertura.
    await fijarHorariosDeVendedor(CORREO_VENDEDOR, horariosConHoyInactivo());

    const productoVisible = await fetch(`${BASE}/api/productos/${producto.id}`);
    verificar(
      "RQNF15 el producto sigue visible aunque el vendedor no esté en horario",
      productoVisible.status === 200,
      `status ${productoVisible.status}`,
    );

    const estadoA2 = await estadoDeFila(producto.id, COMPRADOR_A);
    verificar(
      "RQNF15/RQNF16/RQF18 en su turno y fuera del horario se avisa la próxima apertura y se ofrece esperar",
      estadoA2.status === 200 &&
        estadoA2.cuerpo?.horarioActivo === false &&
        estadoA2.cuerpo?.puedePagar === true &&
        estadoA2.cuerpo?.puedeElegirEspera === true &&
        String(estadoA2.cuerpo?.avisoAtencion ?? "").includes(
          "no está en horario de atención",
        ) &&
        estadoA2.cuerpo?.proximoBloque === "mañana de 00:00 a 23:59",
      `${estadoA2.status}: ${JSON.stringify(estadoA2.cuerpo)}`,
    );

    const filaC = await entrarAFila(
      producto.id,
      COMPRADOR_C,
      "carla.fila@ejemplo.test",
    );
    verificar(
      "RQNF15 fuera del horario no se puede entrar a la fila y se indica la próxima apertura",
      filaC.status === 400 &&
        String(filaC.cuerpo?.message ?? "").includes("próxima apertura") &&
        filaC.cuerpo?.proximoBloque === "mañana de 00:00 a 23:59",
      `${filaC.status}: ${JSON.stringify(filaC.cuerpo)}`,
    );

    const esperaB = await esperarApertura(idFilaB, COMPRADOR_B);
    verificar(
      "RQF18 solo el turno actual puede guardar su lugar hasta la próxima apertura",
      esperaB.status === 400 &&
        String(esperaB.cuerpo?.message ?? "").includes("es tu turno"),
      `${esperaB.status}: ${JSON.stringify(esperaB.cuerpo)}`,
    );

    const ordenAhora = await crearOrden(producto.id, COMPRADOR_A);
    verificar(
      "RQNF16/RQF18 en su turno también puede pagar ahora con el aviso de que la atención se reanuda en la próxima apertura",
      ordenAhora.status === 200 &&
        Boolean(ordenAhora.cuerpo?.orderId) &&
        String(ordenAhora.cuerpo?.avisoAtencion ?? "").includes(
          "bloque de horario de atención",
        ),
      `${ordenAhora.status}: ${JSON.stringify(ordenAhora.cuerpo).slice(0, 300)}`,
    );

    const esperaA = await esperarApertura(idFilaA, COMPRADOR_A);
    verificar(
      "RQF18 el comprador en su turno guarda su lugar hasta la próxima apertura",
      esperaA.status === 200 &&
        String(esperaA.cuerpo?.message ?? "").includes("Guardamos tu lugar") &&
        esperaA.cuerpo?.proximoBloque === "mañana de 00:00 a 23:59",
      `${esperaA.status}: ${JSON.stringify(esperaA.cuerpo)}`,
    );

    const filaAPausada = await leerFila(idFilaA);
    verificar(
      "RQNF18 la fila en espera conserva su lugar y su reloj de pago queda en pausa",
      filaAPausada?.estado === "esperando_apertura" &&
        Number(filaAPausada?.posicion) === 1 &&
        filaAPausada?.pagoExpiraEn === null,
      `estado=${filaAPausada?.estado} posicion=${filaAPausada?.posicion} pagoExpiraEn=${filaAPausada?.pagoExpiraEn}`,
    );

    const estadoA3 = await estadoDeFila(producto.id, COMPRADOR_A);
    verificar(
      "RQNF18 la fila en espera se muestra como tal (sin poder pagar y sin reloj)",
      estadoA3.status === 200 &&
        estadoA3.cuerpo?.enFila === true &&
        estadoA3.cuerpo?.esperandoApertura === true &&
        estadoA3.cuerpo?.puedePagar === false &&
        estadoA3.cuerpo?.pagoExpiraEn === null &&
        Number(estadoA3.cuerpo?.posicion) === 1 &&
        estadoA3.cuerpo?.puedeElegirEspera === false,
      `${estadoA3.status}: ${JSON.stringify(estadoA3.cuerpo)}`,
    );

    const ordenPausada = await crearOrden(producto.id, COMPRADOR_A);
    verificar(
      "RQNF18 una fila en espera no puede pagar hasta reanudarse",
      ordenPausada.status === 403 &&
        String(ordenPausada.cuerpo?.message ?? "").includes("No es tu turno"),
      `${ordenPausada.status}: ${JSON.stringify(ordenPausada.cuerpo)}`,
    );

    const misFilasA = await misFilas(COMPRADOR_A);
    verificar(
      "RQNF18 la fila en espera sigue apareciendo en Mis filas del comprador",
      misFilasA.some(
        (fila) =>
          Number(fila.id) === idFilaA &&
          fila.estado === "esperando_apertura" &&
          Boolean(fila.productoId),
      ),
      JSON.stringify(misFilasA).slice(0, 300),
    );

    const reactivadas1 = await reactivarFilasEnEsperaDeApertura();
    const filaATrasInactivo = await leerFila(idFilaA);
    verificar(
      "RQNF18 con el vendedor todavía fuera de horario la fila no se reanuda",
      filaATrasInactivo?.estado === "esperando_apertura",
      `reactivadas=${reactivadas1} estado=${filaATrasInactivo?.estado}`,
    );

    // El vendedor vuelve a estar disponible: la fila se reanuda sola.
    await fijarHorariosDeVendedor(CORREO_VENDEDOR, []);
    const reactivadas2 = await reactivarFilasEnEsperaDeApertura();
    const filaAReanudada = await leerFila(idFilaA);
    verificar(
      "RQNF18 al abrir el bloque la fila se reanuda conservando su lugar y arranca su reloj",
      filaAReanudada?.estado === "activa" &&
        Number(filaAReanudada?.posicion) === 1 &&
        filaAReanudada?.pagoExpiraEn !== null,
      `reactivadas=${reactivadas2} estado=${filaAReanudada?.estado} posicion=${filaAReanudada?.posicion} pagoExpiraEn=${filaAReanudada?.pagoExpiraEn}`,
    );

    const estadoA4 = await estadoDeFila(producto.id, COMPRADOR_A);
    verificar(
      "RQNF18 reanudada la fila, su turno vuelve a poder pagar",
      estadoA4.status === 200 &&
        estadoA4.cuerpo?.esperandoApertura === false &&
        estadoA4.cuerpo?.puedePagar === true &&
        estadoA4.cuerpo?.horarioActivo === true,
      `${estadoA4.status}: ${JSON.stringify(estadoA4.cuerpo)}`,
    );

    const salidaA = await salirDeFila(idFilaA, COMPRADOR_A);
    const filaBTrasSalir = await leerFila(idFilaB);
    verificar(
      "RQNF18 al liberarse el turno la siguiente persona avanza y arranca su reloj",
      salidaA.status === 200 &&
        filaBTrasSalir?.estado === "activa" &&
        Number(filaBTrasSalir?.posicion) === 1 &&
        filaBTrasSalir?.pagoExpiraEn !== null,
      `salida=${salidaA.status} estado=${filaBTrasSalir?.estado} posicion=${filaBTrasSalir?.posicion} pagoExpiraEn=${filaBTrasSalir?.pagoExpiraEn}`,
    );

    const estadoB2 = await estadoDeFila(producto.id, COMPRADOR_B);
    verificar(
      "RQNF18 el segundo comprador ahora está en turno para pagar",
      estadoB2.status === 200 &&
        Number(estadoB2.cuerpo?.posicion) === 1 &&
        estadoB2.cuerpo?.puedePagar === true,
      `${estadoB2.status}: ${JSON.stringify(estadoB2.cuerpo)}`,
    );
  }
} finally {
  // -------------------------------------------------------------------------
  // Limpieza: filas, productos (y sus imágenes) y cuentas de prueba en
  // PostgreSQL/MongoDB, y todos los procesos/mocks.
  // -------------------------------------------------------------------------
  try {
    for (const producto of productosCreados) {
      await clientePrisma.cola.deleteMany({ where: { productoId: producto.id } });
    }
  } catch (error) {
    console.error("[limpieza] No se pudieron borrar las filas de prueba:", error);
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
  `\nSuite de fila y apertura: ${resultados.length - fallas.length}/${resultados.length} pruebas pasaron`,
);
if (fallas.length > 0) {
  console.log("Fallas:");
  for (const falla of fallas) console.log(` - ${falla.nombre}: ${falla.detalle}`);
  process.exit(1);
}
process.exit(0);
