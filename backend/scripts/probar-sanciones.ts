/**
 * Pruebas E2E de RQNF33, RQNF34, RQNF35 y del espejo de sanciones del
 * BackOffice (RQNF33/34/35), más los ganchos de suspensión administrativa de
 * RQNF37/RQNF38.
 *
 * Cubre:
 *  1. RQNF33: 3 faltas leves -> bloqueo de 7 días aplicado de forma
 *     automática al CREAR el reporte (sin esperar al administrador), visible
 *     en el espejo de MongoDB y aplicado por el middleware (no se puede
 *     publicar).
 *  2. RQNF33: un reporte RECHAZADO por el administrador revierte la falta y
 *     el bloqueo que había generado.
 *  3. RQNF34: 1 falta grave -> 30 días; 2 faltas graves -> suspensión
 *     indefinida; la duración crece con la reincidencia.
 *  4. RQNF35: las faltas graves de revisión inmediata (estafa, suplantación,
 *     amenazas, comprobante falso) suspenden indefinidamente y envían la
 *     cuenta a revisión administrativa.
 *  5. El administrador puede suspender (con motivo), reactivar (lo que
 *     levanta la sanción) y la reactivación queda bloqueada mientras exista
 *     un saldo pendiente (RQNF38); la suspensión por saldo permite iniciar
 *     sesión pero no publicar.
 *  6. RQNF33: el trabajo `revisionSanciones` levanta y avisa los bloqueos
 *     temporales concluidos.
 *  7. RQNF14.1: las faltas de más de 13 meses se purgan y el estado se
 *     recalcula.
 *
 * Levanta un backend de prueba en el puerto 5102 con un mock local de Cloud
 * Vision, y usa directamente PostgreSQL/MongoDB locales (mismos que el
 * backend de desarrollo).
 *
 * Uso (con MongoDB y PostgreSQL locales corriendo):
 *   node --harmony-temporal --import tsx scripts/probar-sanciones.ts
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
import { Sancion } from "../src/models/Sancion.js";
import {
  desbloquearSancionesExpiradas,
  purgarFaltasExpiradas,
} from "../src/services/sancionService.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(__dirname, "..");

const PUERTO_BACKEND = 5102;
const PUERTO_MOCK_VISION = 59098;
const BASE = `http://127.0.0.1:${PUERTO_BACKEND}`;

// --- Variables de los mocks: se fijan ANTES de que corran los servicios ----
process.env.GOOGLE_VISION_API_KEY = "clave-de-prueba";
process.env.GOOGLE_VISION_ENDPOINT = `http://127.0.0.1:${PUERTO_MOCK_VISION}/v1/images:annotate`;
// Correos a consola: las pruebas no envían correo real.
process.env.GMAIL_USER = "";
process.env.GMAIL_APP_PASSWORD = "";

const marca = String(Date.now()).slice(-8);
const PASSWORD = "SancionesIchiba123!";

const CORREO_A = `vendedor.sanciones.a.${marca}@ichiba.test`;
const CORREO_B = `vendedor.sanciones.b.${marca}@ichiba.test`;
const CORREO_C = `vendedor.sanciones.c.${marca}@ichiba.test`;
const CORREO_D = `vendedor.sanciones.d.${marca}@ichiba.test`;
const CORREO_ADMIN = `admin.sanciones.${marca}@ichiba.test`;

const COMPRADOR_UNO = `comprador-sanciones-uno-${marca}`;
const COMPRADOR_DOS = `comprador-sanciones-dos-${marca}`;

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

const MILIS_DIA = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Mock de Cloud Vision (moderación de imágenes de producto)
// ---------------------------------------------------------------------------
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
const carpetaPruebas = path.join(RAIZ, "uploads", "pruebas-sanciones");
fs.mkdirSync(carpetaPruebas, { recursive: true });
const rutaFotoProducto = path.join(carpetaPruebas, "producto.jpg");

await sharp({
  create: {
    width: 600,
    height: 700,
    channels: 3,
    background: { r: 210, g: 220, b: 235 },
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

type ProductoCreado = { id: string; nombre: string; imagenes: string[] };
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

function cuerpoProducto(cambios: Record<string, string> = {}): FormData {
  const base: Record<string, string> = {
    nombre: "Artículo de prueba sanciones",
    precio: "150",
    descripcion:
      "Producto de prueba del flujo de sanciones progresivas (RQNF33/34/35).",
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
): Promise<ProductoCreado | null> {
  const fd = cuerpoProducto({ nombre });
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
    imagenes: datos.imagenes ?? [],
  };
  productosCreados.push(producto);
  return producto;
}

async function intentarPublicar(
  token: string,
  nombre: string,
): Promise<{ status: number; mensaje: string }> {
  const fd = cuerpoProducto({ nombre });
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
  if (r.ok) {
    const datos = (await r.json()) as { _id: string; imagenes?: string[] };
    productosCreados.push({
      id: datos._id,
      nombre,
      imagenes: datos.imagenes ?? [],
    });
    return { status: r.status, mensaje: "" };
  }
  return { status: r.status, mensaje: await mensajeDe(r) };
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
      detalle: "Reporte de prueba E2E de sanciones progresivas",
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
    where: { vendedorId, reportadoPorId: compradorId, categoria },
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

async function suspenderAdmin(
  idEspejo: string,
  tokenAdmin: string,
  motivo?: string,
) {
  const r = await fetch(`${BASE}/api/admin/usuarios/${idEspejo}/suspender`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${tokenAdmin}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(motivo ? { motivo } : {}),
  });
  return { status: r.status, cuerpo: await r.json().catch(() => null) };
}

async function reactivarAdmin(idEspejo: string, tokenAdmin: string) {
  const r = await fetch(`${BASE}/api/admin/usuarios/${idEspejo}/reactivar`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${tokenAdmin}` },
  });
  return { status: r.status, cuerpo: await r.json().catch(() => null) };
}

async function leerSancion(vendedorId: number) {
  return Sancion.findOne({ sujetoTipo: "usuario", sujetoId: String(vendedorId) });
}

async function leerEspejo(vendedorId: number) {
  return Usuario.findOne({ usuarioId: vendedorId }).lean();
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
      paypalEmail: `paypal.sanciones.${marca}@ejemplo.test`,
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
        datosMetodoPago: `paypal.sanciones.${marca}@ejemplo.test`,
        horarios: HORARIOS,
        horarioConfirmadoEn,
        diasSinConfirmarHorario: 0,
        puntosReputacion: 0,
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
  // Preparación: cuatro vendedores (uno por escenario) y un administrador.
  // -------------------------------------------------------------------------
  const idA = await crearCuentaDePrueba({
    correo: CORREO_A,
    nombreCompleto: "Vendedor Sanciones A",
    tipo: "vendedor",
    rfc: `SA${marca}AAA`,
  });
  const idB = await crearCuentaDePrueba({
    correo: CORREO_B,
    nombreCompleto: "Vendedor Sanciones B",
    tipo: "vendedor",
    rfc: `SB${marca}BBB`,
  });
  const idC = await crearCuentaDePrueba({
    correo: CORREO_C,
    nombreCompleto: "Vendedor Sanciones C",
    tipo: "vendedor",
    rfc: `SC${marca}CCC`,
  });
  const idD = await crearCuentaDePrueba({
    correo: CORREO_D,
    nombreCompleto: "Vendedor Sanciones D",
    tipo: "vendedor",
    rfc: `SD${marca}DDD`,
  });
  await crearCuentaDePrueba({
    correo: CORREO_ADMIN,
    nombreCompleto: "Administrador Sanciones",
    tipo: "admin",
    rfc: `AD${marca}QWE`,
  });

  const tokenA = await iniciarSesion(CORREO_A, PASSWORD);
  const tokenB = await iniciarSesion(CORREO_B, PASSWORD);
  const tokenC = await iniciarSesion(CORREO_C, PASSWORD);
  const tokenD = await iniciarSesion(CORREO_D, PASSWORD);
  const tokenAdmin = await iniciarSesion(CORREO_ADMIN, PASSWORD);
  verificar(
    "Cuentas de prueba disponibles (login por el espejo de MongoDB)",
    Boolean(tokenA && tokenB && tokenC && tokenD && tokenAdmin),
    "alguna cuenta no pudo iniciar sesión",
  );

  // -------------------------------------------------------------------------
  // Suite 1: RQNF33 — 3 faltas leves -> bloqueo de 7 días, automático.
  // -------------------------------------------------------------------------
  if (tokenA && tokenAdmin) {
    const inicial = await crearProducto("Producto sin sanciones", tokenA);
    verificar(
      "RQNF33 sin faltas la cuenta publica con normalidad",
      Boolean(inicial),
      "no se pudo crear el producto inicial",
    );

    const leves = ["falta_respeto", "lenguaje_ofensivo", "actitud_hostil"];
    const respuestas: Array<{ status: number; cuerpo: any }> = [];
    for (const categoria of leves) {
      respuestas.push(await crearReporte(COMPRADOR_UNO, idA, categoria));
    }

    const sancionA = await leerSancion(idA);
    const hasta = sancionA?.bloqueadoHasta
      ? new Date(sancionA.bloqueadoHasta).getTime()
      : 0;
    const esperado = Date.now() + 7 * MILIS_DIA;
    verificar(
      "RQNF33 las faltas se aplican al crear el reporte (sin esperar al administrador)",
      respuestas.every((r) => r.status === 201) &&
        sancionA?.faltasLeves === 3 &&
        sancionA?.faltasGraves === 0,
      `respuestas=${respuestas.map((r) => r.status).join(",")} faltas=${sancionA?.faltasLeves}`,
    );
    verificar(
      "RQNF33 con 3 faltas leves el bloqueo es de 7 días",
      Math.abs(hasta - esperado) < 5 * 60 * 1000 &&
        sancionA?.bloqueoPermanente === false &&
        sancionA?.bloqueosAplicados === 1,
      `hasta=${sancionA?.bloqueadoHasta} aplicados=${sancionA?.bloqueosAplicados}`,
    );
    verificar(
      "RQNF33 el tercer reporte avisa que el sujeto quedó sancionado",
      respuestas[2]?.cuerpo?.sujetoSancionado === true &&
        respuestas[0]?.cuerpo?.sujetoSancionado === false,
      JSON.stringify(respuestas.map((r) => r.cuerpo?.sujetoSancionado)),
    );

    const espejoA = await leerEspejo(idA);
    verificar(
      "RQNF33 el espejo del BackOffice refleja el bloqueo temporal",
      espejoA?.sancionHasta instanceof Date &&
        espejoA?.sancionPermanente === false &&
        espejoA?.revisionAdministrativa === false &&
        espejoA?.bloqueosAplicados === 1,
      JSON.stringify({
        hasta: espejoA?.sancionHasta,
        permanente: espejoA?.sancionPermanente,
      }),
    );

    const bloqueada = await intentarPublicar(tokenA, "Producto bloqueado");
    verificar(
      "RQNF33 durante el bloqueo no se puede publicar (middleware)",
      bloqueada.status === 403 && bloqueada.mensaje.includes("sanción activa"),
      `${bloqueada.status}: ${bloqueada.mensaje}`,
    );

    const rUsuarios = await fetch(`${BASE}/api/admin/usuarios?porPagina=100`, {
      headers: { Authorization: `Bearer ${tokenAdmin}` },
    });
    const listado = (await rUsuarios.json().catch(() => null)) as any;
    const enLista = (listado?.usuarios ?? []).find(
      (u: any) => u.correo === CORREO_A,
    );
    verificar(
      "RQNF33 el panel del administrador muestra el bloqueo vigente",
      rUsuarios.ok &&
        enLista?.sancionPermanente === false &&
        Boolean(enLista?.sancionHasta) &&
        enLista?.revisionAdministrativa === false,
      JSON.stringify(enLista),
    );

    // -----------------------------------------------------------------------
    // Suite 2: RQNF33 — un reporte rechazado revierte la falta y el bloqueo.
    // -----------------------------------------------------------------------
    const reporteTercero = await buscarReporte(idA, COMPRADOR_UNO, "actitud_hostil");
    if (reporteTercero) {
      const rechazo = await resolverReporte(
        Number(reporteTercero.id),
        tokenAdmin,
        "rechazado",
      );
      const sancionTrasRechazo = await leerSancion(idA);
      const espejoTrasRechazo = await leerEspejo(idA);
      verificar(
        "RQNF33 rechazar un reporte revierte la falta y recalcula el bloqueo",
        rechazo.status === 200 &&
          sancionTrasRechazo?.faltasLeves === 2 &&
          sancionTrasRechazo?.bloqueosAplicados === 0 &&
          sancionTrasRechazo?.bloqueadoHasta === null &&
          espejoTrasRechazo?.sancionHasta === null,
        `faltas=${sancionTrasRechazo?.faltasLeves} hasta=${sancionTrasRechazo?.bloqueadoHasta} espejo=${espejoTrasRechazo?.sancionHasta}`,
      );

      const desbloqueada = await intentarPublicar(
        tokenA,
        "Producto tras rechazo",
      );
      verificar(
        "RQNF33 al revertirse el bloqueo la cuenta vuelve a publicar",
        desbloqueada.status === 201,
        `${desbloqueada.status}: ${desbloqueada.mensaje}`,
      );
    } else {
      verificar(
        "RQNF33 rechazar un reporte revierte la falta y recalcula el bloqueo",
        false,
        "no se encontró el reporte a rechazar",
      );
    }

    // -----------------------------------------------------------------------
    // Suite 3: RQNF34 — 1 falta grave -> 30 días; 2 graves -> indefinida.
    // -----------------------------------------------------------------------
    const graveUno = await crearReporte(COMPRADOR_UNO, idA, "producto_enganoso");
    const sancionGrave = await leerSancion(idA);
    const hastaGrave = sancionGrave?.bloqueadoHasta
      ? new Date(sancionGrave.bloqueadoHasta).getTime()
      : 0;
    verificar(
      "RQNF34 una falta grave aplica un bloqueo de 30 días",
      graveUno.status === 201 &&
        sancionGrave?.faltasGraves === 1 &&
        Math.abs(hastaGrave - (Date.now() + 30 * MILIS_DIA)) < 5 * 60 * 1000 &&
        sancionGrave?.bloqueoPermanente === false,
      `hasta=${sancionGrave?.bloqueadoHasta}`,
    );

    const graveDos = await crearReporte(COMPRADOR_DOS, idA, "discriminacion");
    const sancionIndefinida = await leerSancion(idA);
    const espejoIndefinido = await leerEspejo(idA);
    verificar(
      "RQNF34 la segunda falta grave suspende de forma indefinida",
      graveDos.status === 201 &&
        sancionIndefinida?.faltasGraves === 2 &&
        sancionIndefinida?.bloqueoPermanente === true &&
        sancionIndefinida?.bloqueadoHasta === null &&
        espejoIndefinido?.sancionPermanente === true,
      `graves=${sancionIndefinida?.faltasGraves} permanente=${sancionIndefinida?.bloqueoPermanente}`,
    );

    const bloqueoIndefinido = await intentarPublicar(
      tokenA,
      "Producto con suspensión indefinida",
    );
    verificar(
      "RQNF34 la suspensión indefinida impide publicar con el motivo correcto",
      bloqueoIndefinido.status === 403 &&
        bloqueoIndefinido.mensaje.includes("permanente"),
      `${bloqueoIndefinido.status}: ${bloqueoIndefinido.mensaje}`,
    );
  }

  // -------------------------------------------------------------------------
  // Suite 4: RQNF35 — falta de revisión inmediata -> indefinida + revisión.
  // -------------------------------------------------------------------------
  if (tokenB && tokenAdmin) {
    const estafa = await crearReporte(COMPRADOR_UNO, idB, "estafa");
    const sancionB = await leerSancion(idB);
    const espejoB = await leerEspejo(idB);
    verificar(
      "RQNF35 una falta grave de revisión inmediata suspende y manda a revisión",
      estafa.status === 201 &&
        sancionB?.bloqueoPermanente === true &&
        sancionB?.revisionAdministrativa === true &&
        String(sancionB?.revisionMotivo ?? "").includes("estafa") &&
        espejoB?.revisionAdministrativa === true,
      `permanente=${sancionB?.bloqueoPermanente} revision=${sancionB?.revisionAdministrativa}`,
    );

    const bloqueadaRevision = await intentarPublicar(
      tokenB,
      "Producto en revisión administrativa",
    );
    verificar(
      "RQNF35 la revisión administrativa se avisa al intentar publicar",
      bloqueadaRevision.status === 403 &&
        bloqueadaRevision.mensaje.includes("revisión administrativa"),
      `${bloqueadaRevision.status}: ${bloqueadaRevision.mensaje}`,
    );

    // -----------------------------------------------------------------------
    // Suite 5: suspensión manual con motivo, login bloqueado y reactivación
    // (la reactivación levanta la sanción, RQNF35).
    // -----------------------------------------------------------------------
    const espejoDoc = await leerEspejo(idB);
    const idMongoB = String(espejoDoc?._id ?? "");
    const suspender = await suspenderAdmin(
      idMongoB,
      tokenAdmin,
      "investigación de fraude",
    );
    const espejoSuspendido = await leerEspejo(idB);
    verificar(
      "RQNF37 el administrador suspende con motivo y queda en el espejo",
      suspender.status === 200 &&
        espejoSuspendido?.suspendido === true &&
        espejoSuspendido?.motivoSuspension === "investigación de fraude",
      `${suspender.status}: ${JSON.stringify(suspender.cuerpo)}`,
    );

    const loginSuspendido = await iniciarSesion(CORREO_B, PASSWORD);
    verificar(
      "RQNF37 una cuenta suspendida por la administración no puede iniciar sesión",
      loginSuspendido === null,
      "el login no fue rechazado",
    );

    const reactivar = await reactivarAdmin(idMongoB, tokenAdmin);
    const sancionTrasReactivar = await leerSancion(idB);
    const espejoReactivado = await leerEspejo(idB);
    verificar(
      "RQNF35 reactivar levanta la sanción (incluida la revisión administrativa)",
      reactivar.status === 200 &&
        sancionTrasReactivar?.levantadaPorAdminEn instanceof Date &&
        espejoReactivado?.suspendido === false &&
        espejoReactivado?.revisionAdministrativa === false &&
        espejoReactivado?.sancionPermanente === false,
      `${reactivar.status}: ${JSON.stringify(reactivar.cuerpo)}`,
    );

    const tokenBTrasReactivar = await iniciarSesion(CORREO_B, PASSWORD);
    verificar(
      "RQNF35 tras la reactivación la cuenta vuelve a iniciar sesión",
      Boolean(tokenBTrasReactivar),
      "no pudo iniciar sesión tras reactivar",
    );
    if (tokenBTrasReactivar) {
      const publicarTrasReactivar = await intentarPublicar(
        tokenBTrasReactivar,
        "Producto tras reactivación",
      );
      verificar(
        "RQNF35 tras la reactivación la cuenta vuelve a publicar",
        publicarTrasReactivar.status === 201,
        `${publicarTrasReactivar.status}: ${publicarTrasReactivar.mensaje}`,
      );
    }

    // Una falta nueva descarta el levantamiento manual y vuelve a sancionar.
    const nuevaFalta = await crearReporte(COMPRADOR_DOS, idB, "acoso");
    const sancionRecaida = await leerSancion(idB);
    verificar(
      "RQNF34 una falta nueva tras la reactivación vuelve a aplicar la sanción",
      nuevaFalta.status === 201 &&
        sancionRecaida?.levantadaPorAdminEn == null &&
        sancionRecaida?.bloqueoPermanente === true &&
        sancionRecaida?.revisionAdministrativa === true,
      `levantada=${sancionRecaida?.levantadaPorAdminEn} permanente=${sancionRecaida?.bloqueoPermanente}`,
    );
  }

  // -------------------------------------------------------------------------
  // Suite 6: RQNF33 — el trabajo levanta los bloqueos temporales concluidos.
  // -------------------------------------------------------------------------
  if (tokenC) {
    const graveC = await crearReporte(COMPRADOR_UNO, idC, "producto_enganoso");
    const sancionC = await leerSancion(idC);
    verificar(
      "RQNF33 preparado un bloqueo temporal del vendedor C",
      graveC.status === 201 &&
        sancionC?.bloqueadoHasta instanceof Date &&
        sancionC?.bloqueoPermanente === false,
      `hasta=${sancionC?.bloqueadoHasta}`,
    );

    // Se simula que el periodo ya concluyó.
    await Sancion.updateOne(
      { sujetoTipo: "usuario", sujetoId: String(idC) },
      { $set: { bloqueadoHasta: new Date(Date.now() - MILIS_DIA) } },
    );

    const avisadas = await desbloquearSancionesExpiradas();
    const sancionTrasJob = await leerSancion(idC);
    const espejoTrasJob = await leerEspejo(idC);
    verificar(
      "RQNF33 al concluir el periodo el bloqueo se levanta y se avisa una sola vez",
      avisadas >= 1 &&
        sancionTrasJob?.avisoDesbloqueoEn instanceof Date &&
        espejoTrasJob?.sancionHasta === null,
      `avisadas=${avisadas} aviso=${sancionTrasJob?.avisoDesbloqueoEn}`,
    );

    const publicarC = await intentarPublicar(tokenC, "Producto tras desbloqueo");
    verificar(
      "RQNF33 tras el desbloqueo automático la cuenta vuelve a publicar",
      publicarC.status === 201,
      `${publicarC.status}: ${publicarC.mensaje}`,
    );
  }

  // -------------------------------------------------------------------------
  // Suite 7: RQNF14.1 — las faltas prescriben a los 13 meses.
  // -------------------------------------------------------------------------
  if (tokenD) {
    const graveD = await crearReporte(COMPRADOR_UNO, idD, "producto_enganoso");
    verificar(
      "RQNF14.1 preparado un bloqueo temporal del vendedor D",
      graveD.status === 201,
      `status=${graveD.status}`,
    );

    const haceCatorceMeses = new Date();
    haceCatorceMeses.setMonth(haceCatorceMeses.getMonth() - 14);
    await Sancion.updateOne(
      { sujetoTipo: "usuario", sujetoId: String(idD) },
      { $set: { "historial.0.fecha": haceCatorceMeses } },
    );

    const purga = await purgarFaltasExpiradas();
    const sancionPurga = await leerSancion(idD);
    const espejoPurga = await leerEspejo(idD);
    verificar(
      "RQNF14.1 las faltas de más de 13 meses se purgan y el estado se recalcula",
      purga.faltas >= 1 &&
        (sancionPurga?.historial?.length ?? -1) === 0 &&
        sancionPurga?.faltasGraves === 0 &&
        sancionPurga?.bloqueoPermanente === false &&
        espejoPurga?.sancionHasta === null,
      `purgadas=${purga.faltas} historial=${sancionPurga?.historial?.length}`,
    );
  }

  // -------------------------------------------------------------------------
  // Suite 8: RQNF37 / RQNF38 — suspensión por saldo pendiente.
  // -------------------------------------------------------------------------
  if (tokenD && tokenAdmin) {
    await Usuario.updateOne(
      { usuarioId: idD },
      {
        $set: {
          suspendido: true,
          motivoSuspension: "saldo_pendiente",
          saldoPendiente: 250.5,
        },
      },
    );

    const loginSaldo = await iniciarSesion(CORREO_D, PASSWORD);
    verificar(
      "RQNF38 la suspensión por saldo pendiente permite iniciar sesión",
      Boolean(loginSaldo),
      "el login fue rechazado",
    );

    if (loginSaldo) {
      const publicarSaldo = await intentarPublicar(
        loginSaldo,
        "Producto con saldo pendiente",
      );
      verificar(
        "RQNF38 con saldo pendiente no se puede publicar y se muestra el monto",
        publicarSaldo.status === 403 &&
          publicarSaldo.mensaje.includes("saldo pendiente") &&
          publicarSaldo.mensaje.includes("250.50"),
        `${publicarSaldo.status}: ${publicarSaldo.mensaje}`,
      );
    }

    const espejoDocD = await leerEspejo(idD);
    const idMongoD = String(espejoDocD?._id ?? "");
    const reactivarBloqueado = await reactivarAdmin(idMongoD, tokenAdmin);
    verificar(
      "RQNF38 la reactivación queda bloqueada mientras exista el adeudo",
      reactivarBloqueado.status === 400 &&
        String(reactivarBloqueado.cuerpo?.message ?? "").includes(
          "saldo pendiente",
        ),
      `${reactivarBloqueado.status}: ${JSON.stringify(reactivarBloqueado.cuerpo)}`,
    );

    await Usuario.updateOne(
      { usuarioId: idD },
      { $set: { saldoPendiente: 0 } },
    );
    const reactivarOk = await reactivarAdmin(idMongoD, tokenAdmin);
    const espejoReactivadoD = await leerEspejo(idD);
    verificar(
      "RQNF38 al liquidar el adeudo la cuenta puede reactivarse",
      reactivarOk.status === 200 &&
        espejoReactivadoD?.suspendido === false &&
        espejoReactivadoD?.motivoSuspension === null,
      `${reactivarOk.status}: ${JSON.stringify(reactivarOk.cuerpo)}`,
    );
  }
} finally {
  // -------------------------------------------------------------------------
  // Limpieza: productos, reportes, sanciones, espejos y cuentas de prueba.
  // -------------------------------------------------------------------------
  try {
    for (const idCuenta of idsCuentas) {
      await clientePrisma.reporte.deleteMany({ where: { vendedorId: idCuenta } });
    }
  } catch (error) {
    console.error("[limpieza] No se pudieron borrar reportes:", error);
  }

  try {
    await Sancion.deleteMany({ sujetoId: { $in: idsCuentas.map(String) } });
  } catch (error) {
    console.error("[limpieza] No se pudieron borrar las sanciones:", error);
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
  try {
    servidorVision.close();
  } catch {
    /* ignorar */
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
  `\nSuite de sanciones: ${resultados.length - fallas.length}/${resultados.length} pruebas pasaron`,
);
if (fallas.length > 0) {
  console.log("Fallas:");
  for (const falla of fallas) console.log(` - ${falla.nombre}: ${falla.detalle}`);
  process.exit(1);
}
process.exit(0);
