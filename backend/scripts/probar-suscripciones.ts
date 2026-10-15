/**
 * Pruebas E2E de la Fase 4: BackOffice en vivo con GraphQL Subscriptions.
 *
 * Cubre:
 *  1. El servidor WebSocket montado en la misma ruta que GraphQL
 *     (`ws://…/graphql`) con el protocolo `graphql-transport-ws`.
 *  2. El control de acceso: sin token y con token de vendedor la conexión se
 *     rechaza con el cierre 4403 (Forbidden); solo entra un administrador.
 *  3. Las cuatro suscripciones del BackOffice, cada una disparada por su
 *     operación real vía REST:
 *       - `reportesPendientes`  al crear un reporte y al rechazarlo;
 *       - `resumenAdmin`        al suspender un usuario (resumen fresco);
 *       - `usuariosAdmin`       al reactivar un usuario;
 *       - `listaNegraActualizada` al agregar y quitar una entrada.
 *  4. Que el esquema GraphQL sigue funcionando por HTTP (query `estado`).
 *
 * Levanta un backend de prueba en el puerto 5100 y usa directamente
 * PostgreSQL/MongoDB locales (mismos que el backend de desarrollo). Crea
 * cuentas y datos de prueba y los elimina al terminar.
 *
 * Uso (con MongoDB y PostgreSQL locales corriendo):
 *   node --harmony-temporal --import tsx scripts/probar-suscripciones.ts
 */
import "dotenv/config";
import { spawn, type ChildProcess } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import WebSocket from "ws";
import { createClient, type Client } from "graphql-ws";
import clientePrisma from "../src/configuracion/prisma.js";
import { Usuario } from "../src/models/usuario.js";
import { ListaNegra } from "../src/models/ListaNegra.js";
import { Sancion } from "../src/models/Sancion.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(__dirname, "..");

const PUERTO_BACKEND = 5100;
const BASE = `http://127.0.0.1:${PUERTO_BACKEND}`;
const URL_WS = `ws://127.0.0.1:${PUERTO_BACKEND}/graphql`;

// Correos a consola: las pruebas no envían correo real.
process.env.GMAIL_USER = "";
process.env.GMAIL_APP_PASSWORD = "";

const marca = String(Date.now()).slice(-8);
const CORREO_VENDEDOR = `vendedor.susc.${marca}@ichiba.test`;
const PASSWORD_VENDEDOR = "SuscripcionesIchiba123!";
const CORREO_ADMIN = `admin.susc.${marca}@ichiba.test`;
const PASSWORD_ADMIN = "AdminSuscripciones123!";
const CORREO_PAYPAL = `paypal.susc.${marca}@ejemplo.test`;
const RFC_LISTA_NEGRA = `SUSC${marca}`;
const COMPRADOR_PRUEBA = `comprador-susc-${marca}`;

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

const CONSULTA_RESUMEN = `
  subscription {
    resumenAdmin {
      generadoEn
      usuarios { total suspendidos }
      reportes { pendientes total }
      listaNegra { total }
    }
  }
`;

const CONSULTA_REPORTES = `
  subscription {
    reportesPendientes { tipo mensaje pendientes generadoEn }
  }
`;

const CONSULTA_USUARIOS = `
  subscription {
    usuariosAdmin {
      tipo mensaje generadoEn
      usuario { id nombreCompleto suspendido estadoCuenta }
    }
  }
`;

const CONSULTA_LISTA_NEGRA = `
  subscription {
    listaNegraActualizada { tipo mensaje entradas generadoEn }
  }
`;

// ---------------------------------------------------------------------------
// Infraestructura del backend de prueba
// ---------------------------------------------------------------------------
const hijos: ChildProcess[] = [];

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
  hijos.push(hijo);
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
// Helpers generales
// ---------------------------------------------------------------------------
type Resultado = { nombre: string; ok: boolean; detalle: string };
const resultados: Resultado[] = [];

function verificar(nombre: string, ok: boolean, detalle = "") {
  resultados.push({ nombre, ok, detalle });
  console.log(`${ok ? "PASA " : "FALLA"} ${nombre}${ok ? "" : ` — ${detalle}`}`);
}

const idsCuentas: number[] = [];
const correosCuentas: string[] = [];
const reportesCreados: number[] = [];

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
  password: string;
  tipo: "vendedor" | "admin";
  rfc: string;
}): Promise<number> {
  const passwordHasheada = await bcrypt.hash(opciones.password, 10);
  const horarioConfirmadoEn = new Date();

  const creado = await clientePrisma.usuario.create({
    data: {
      nombreCompleto: opciones.nombreCompleto,
      direccion: "Av. de las Pruebas 300, Centro, Ciudad de México",
      telefono: "5577777777",
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
      horarios: HORARIOS,
      horarioConfirmadoEn,
      diasSinConfirmarHorario: 0,
      estadoCuenta: "activa",
    },
  });

  await Usuario.updateOne(
    { correo: opciones.correo },
    {
      $set: {
        usuarioId: creado.id,
        nombreCompleto: opciones.nombreCompleto,
        direccion: "Av. de las Pruebas 300, Centro, Ciudad de México",
        telefono: "5577777777",
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

// ---------------------------------------------------------------------------
// Helpers de suscripciones
// ---------------------------------------------------------------------------
function crearClienteDeSuscripciones(token?: string): Client {
  return createClient({
    url: URL_WS,
    webSocketImpl: WebSocket,
    connectionParams: token ? { Authorization: `Bearer ${token}` } : {},
    retryAttempts: 0,
    lazy: false,
    // Las pruebas esperan los cierres 4403 a propósito: no ensuciar la salida.
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

/** Espera el rechazo de la conexión (sin token / token que no es admin). */
function esperarRechazo(
  cliente: Client,
): Promise<{ codigo?: number; detalle: string }> {
  return new Promise((resolver) => {
    const temporizador = setTimeout(
      () => resolver({ detalle: "sin respuesta (timeout)" }),
      10000,
    );
    cliente.subscribe(
      { query: CONSULTA_RESUMEN },
      {
        next: () => {},
        error: (error) => {
          clearTimeout(temporizador);
          const evento = error as { code?: number; reason?: string };
          resolver({
            codigo: evento?.code,
            detalle: `code=${evento?.code} reason=${evento?.reason ?? "?"}`,
          });
        },
        complete: () => {},
      },
    );
  });
}

async function peticion(
  ruta: string,
  token: string | undefined,
  metodo: string,
  cuerpo?: unknown,
): Promise<Response> {
  return fetch(`${BASE}${ruta}`, {
    method: metodo,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(cuerpo ? { "Content-Type": "application/json" } : {}),
    },
    ...(cuerpo ? { body: JSON.stringify(cuerpo) } : {}),
  });
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------
async function main() {
  arrancarBackend();
  await esperarSalud(PUERTO_BACKEND);
  await mongoose.connect(process.env.MONGO_URI as string);

  const idVendedor = await crearCuentaDePrueba({
    correo: CORREO_VENDEDOR,
    nombreCompleto: `Vendedor Suscripciones ${marca}`,
    password: PASSWORD_VENDEDOR,
    tipo: "vendedor",
    rfc: `VEND${marca}`,
  });
  await crearCuentaDePrueba({
    correo: CORREO_ADMIN,
    nombreCompleto: `Admin Suscripciones ${marca}`,
    password: PASSWORD_ADMIN,
    tipo: "admin",
    rfc: `ADMI${marca}`,
  });

  const tokenVendedor = await iniciarSesion(CORREO_VENDEDOR, PASSWORD_VENDEDOR);
  const tokenAdmin = await iniciarSesion(CORREO_ADMIN, PASSWORD_ADMIN);
  verificar(
    "las cuentas de prueba inician sesión (token real de la API)",
    Boolean(tokenVendedor && tokenAdmin),
    `vendedor=${Boolean(tokenVendedor)} admin=${Boolean(tokenAdmin)}`,
  );

  const espejoVendedor = await Usuario.findOne({
    correo: CORREO_VENDEDOR,
  }).lean();
  const idEspejoVendedor = String(espejoVendedor?._id ?? "");
  verificar(
    "el espejo de MongoDB del vendedor existe (lo usan suspender/reactivar)",
    Boolean(idEspejoVendedor),
    `idEspejo=${idEspejoVendedor}`,
  );

  // -------------------------------------------------------------------------
  // 1. Control de acceso del WebSocket
  // -------------------------------------------------------------------------
  const clienteSinToken = crearClienteDeSuscripciones();
  const rechazoSinToken = await esperarRechazo(clienteSinToken);
  verificar(
    "la suscripción rechaza conexiones sin token (cierre 4403)",
    rechazoSinToken.codigo === 4403,
    rechazoSinToken.detalle,
  );
  void clienteSinToken.dispose();

  const clienteVendedor = crearClienteDeSuscripciones(tokenVendedor ?? "");
  const rechazoVendedor = await esperarRechazo(clienteVendedor);
  verificar(
    "la suscripción rechaza a un vendedor: solo entra el administrador (4403)",
    rechazoVendedor.codigo === 4403,
    rechazoVendedor.detalle,
  );
  void clienteVendedor.dispose();

  const clienteAdmin = crearClienteDeSuscripciones(tokenAdmin ?? "");

  // -------------------------------------------------------------------------
  // 2. reportesPendientes: se crea un reporte y luego se rechaza
  // -------------------------------------------------------------------------
  let idReporte = 0;
  try {
    const evento = await esperarEvento<{
      tipo: string;
      mensaje: string;
      pendientes: number;
      generadoEn: string;
    }>(
      clienteAdmin,
      CONSULTA_REPORTES,
      "reportesPendientes",
      (dato) => dato.tipo === "creado",
      async () => {
        const r = await fetch(`${BASE}/api/reportes`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-comprador-id": COMPRADOR_PRUEBA,
          },
          body: JSON.stringify({
            sujetoId: String(idVendedor),
            sujetoTipo: "usuario",
            elemento: "otro",
            categoria: "otro",
            detalle: "Reporte de prueba de suscripciones (se elimina al terminar)",
          }),
        });
        if (!r.ok) {
          throw new Error(`POST /api/reportes respondió ${r.status}: ${await mensajeDe(r)}`);
        }
      },
    );

    verificar(
      "`reportesPendientes` emite «creado» al enviar un reporte nuevo",
      evento.tipo === "creado" &&
        typeof evento.pendientes === "number" &&
        evento.pendientes >= 1 &&
        typeof evento.generadoEn === "string",
      `tipo=${evento.tipo} pendientes=${evento.pendientes}`,
    );

    const reporte = await clientePrisma.reporte.findFirst({
      where: { vendedorId: idVendedor },
      orderBy: { createdAt: "desc" },
    });
    idReporte = reporte ? Number(reporte.id) : 0;

    const eventoRechazo = await esperarEvento<{
      tipo: string;
      mensaje: string;
      pendientes: number;
    }>(
      clienteAdmin,
      CONSULTA_REPORTES,
      "reportesPendientes",
      (dato) => dato.tipo === "rechazado",
      async () => {
        const r = await peticion(
          `/api/admin/reportes/${idReporte}/resolver`,
          tokenAdmin,
          "PATCH",
          { resultado: "rechazado" },
        );
        if (!r.ok) {
          throw new Error(`resolver respondió ${r.status}: ${await mensajeDe(r)}`);
        }
      },
    );
    verificar(
      "`reportesPendientes` emite «rechazado» al resolver el reporte por REST",
      eventoRechazo.tipo === "rechazado" &&
        typeof eventoRechazo.pendientes === "number",
      `tipo=${eventoRechazo.tipo} pendientes=${eventoRechazo.pendientes}`,
    );
  } finally {
    if (idReporte === 0) {
      const reporte = await clientePrisma.reporte.findFirst({
        where: { vendedorId: idVendedor },
        orderBy: { createdAt: "desc" },
      });
      idReporte = reporte ? Number(reporte.id) : 0;
    }
    if (idReporte > 0) reportesCreados.push(idReporte);
  }

  // -------------------------------------------------------------------------
  // 3. resumenAdmin: se emite el resumen fresco al suspender al vendedor
  // -------------------------------------------------------------------------
  const eventoResumen = await esperarEvento<{
    generadoEn: string;
    usuarios: { total: number; suspendidos: number };
    reportes: { pendientes: number; total: number };
    listaNegra: { total: number };
  }>(
    clienteAdmin,
    CONSULTA_RESUMEN,
    "resumenAdmin",
    (dato) => dato.usuarios.suspendidos >= 1,
    async () => {
      const r = await peticion(
        `/api/admin/usuarios/${idEspejoVendedor}/suspender`,
        tokenAdmin,
        "PATCH",
      );
      if (!r.ok) {
        throw new Error(`suspender respondió ${r.status}: ${await mensajeDe(r)}`);
      }
    },
  );
  verificar(
    "`resumenAdmin` entrega el resumen completo y fresco al suspender un usuario",
    typeof eventoResumen.generadoEn === "string" &&
      eventoResumen.usuarios.total >= 2 &&
      eventoResumen.usuarios.suspendidos >= 1 &&
      typeof eventoResumen.reportes.total === "number" &&
      typeof eventoResumen.listaNegra.total === "number",
    `usuarios=${JSON.stringify(eventoResumen.usuarios)}`,
  );

  // -------------------------------------------------------------------------
  // 4. usuariosAdmin: reactivación del vendedor
  // -------------------------------------------------------------------------
  const eventoUsuario = await esperarEvento<{
    tipo: string;
    mensaje: string;
    usuario: { id: string; suspendido: boolean; estadoCuenta: string } | null;
  }>(
    clienteAdmin,
    CONSULTA_USUARIOS,
    "usuariosAdmin",
    (dato) => dato.tipo === "reactivado",
    async () => {
      const r = await peticion(
        `/api/admin/usuarios/${idEspejoVendedor}/reactivar`,
        tokenAdmin,
        "PATCH",
      );
      if (!r.ok) {
        throw new Error(`reactivar respondió ${r.status}: ${await mensajeDe(r)}`);
      }
    },
  );
  verificar(
    "`usuariosAdmin` emite «reactivado» con el usuario actualizado",
    eventoUsuario.tipo === "reactivado" &&
      eventoUsuario.usuario?.id === idEspejoVendedor &&
      eventoUsuario.usuario?.suspendido === false,
    `tipo=${eventoUsuario.tipo} usuario=${JSON.stringify(eventoUsuario.usuario)}`,
  );

  // -------------------------------------------------------------------------
  // 5. listaNegraActualizada: alta y baja de un registro
  // -------------------------------------------------------------------------
  let idEntradaListaNegra = "";
  const eventoAlta = await esperarEvento<{
    tipo: string;
    mensaje: string;
    entradas: number;
  }>(
    clienteAdmin,
    CONSULTA_LISTA_NEGRA,
    "listaNegraActualizada",
    (dato) => dato.tipo === "agregada",
    async () => {
      const r = await peticion("/api/admin/lista-negra", tokenAdmin, "POST", {
        rfc: RFC_LISTA_NEGRA,
        nombreCompleto: `Persona de prueba ${marca}`,
        motivo: "Prueba de suscripciones (se elimina al terminar)",
      });
      if (!r.ok) {
        throw new Error(
          `POST lista negra respondió ${r.status}: ${await mensajeDe(r)}`,
        );
      }
      const entrada = (await r.json()) as { id?: string };
      idEntradaListaNegra = String(entrada.id ?? "");
    },
  );
  verificar(
    "`listaNegraActualizada` emite «agregada» al dar de alta un registro",
    eventoAlta.tipo === "agregada" && eventoAlta.entradas >= 1,
    `tipo=${eventoAlta.tipo} entradas=${eventoAlta.entradas}`,
  );

  if (idEntradaListaNegra) {
    const eventoBaja = await esperarEvento<{
      tipo: string;
      mensaje: string;
      entradas: number;
    }>(
      clienteAdmin,
      CONSULTA_LISTA_NEGRA,
      "listaNegraActualizada",
      (dato) => dato.tipo === "quitada",
      async () => {
        const r = await peticion(
          `/api/admin/lista-negra/${idEntradaListaNegra}`,
          tokenAdmin,
          "DELETE",
        );
        if (!r.ok) {
          throw new Error(
            `DELETE lista negra respondió ${r.status}: ${await mensajeDe(r)}`,
          );
        }
      },
    );
    verificar(
      "`listaNegraActualizada` emite «quitada» al eliminar el registro",
      eventoBaja.tipo === "quitada" && typeof eventoBaja.entradas === "number",
      `tipo=${eventoBaja.tipo} entradas=${eventoBaja.entradas}`,
    );
  } else {
    verificar(
      "`listaNegraActualizada` emite «quitada» al eliminar el registro",
      false,
      "no se obtuvo el id de la entrada creada",
    );
  }

  // -------------------------------------------------------------------------
  // 6. El mismo esquema sigue respondiendo por HTTP
  // -------------------------------------------------------------------------
  const respuestaHttp = await fetch(`${BASE}/graphql`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: "{ estado }" }),
  });
  const cuerpoHttp = (await respuestaHttp.json()) as {
    data?: { estado?: string };
  };
  verificar(
    "GraphQL por HTTP sigue funcionando con el esquema ejecutable compartido",
    respuestaHttp.ok && cuerpoHttp.data?.estado === "graphql activo",
    `estado=${respuestaHttp.status} datos=${JSON.stringify(cuerpoHttp.data)}`,
  );

  void clienteAdmin.dispose();
}

// ---------------------------------------------------------------------------
// Ejecución + limpieza
// ---------------------------------------------------------------------------
try {
  await main();
} catch (error) {
  verificar(
    "la suite corre de principio a fin",
    false,
    error instanceof Error ? error.message : String(error),
  );
} finally {
  // -------------------------------------------------------------------------
  // Limpieza: reportes y cuentas de PostgreSQL; espejos, sanciones y lista
  // negra de MongoDB; backend y conexiones.
  // -------------------------------------------------------------------------
  try {
    for (const reporteId of reportesCreados) {
      await clientePrisma.reporte.deleteMany({ where: { id: reporteId } });
    }
    for (const idCuenta of idsCuentas) {
      await clientePrisma.reporte.deleteMany({ where: { vendedorId: idCuenta } });
      await clientePrisma.usuario.deleteMany({ where: { id: idCuenta } });
    }
  } catch (error) {
    console.error("[limpieza] No se pudieron borrar reportes/cuentas:", error);
  }

  try {
    for (const idCuenta of idsCuentas) {
      await Sancion.deleteMany({ sujetoId: String(idCuenta) });
    }
    await ListaNegra.deleteMany({ rfc: RFC_LISTA_NEGRA });
    await Usuario.deleteMany({ correo: { $in: correosCuentas } });
  } catch (error) {
    console.error("[limpieza] No se pudieron borrar los espejos de Mongo:", error);
  }

  for (const hijo of hijos) {
    try {
      hijo.kill();
    } catch {
      /* ignorar */
    }
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
  `\nSuite de suscripciones del BackOffice: ${resultados.length - fallas.length}/${resultados.length} pruebas pasaron`,
);
if (fallas.length > 0) {
  console.log("Fallas:");
  for (const falla of fallas) console.log(` - ${falla.nombre}: ${falla.detalle}`);
  process.exit(1);
}
process.exit(0);
