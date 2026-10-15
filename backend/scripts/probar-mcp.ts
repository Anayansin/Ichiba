/**
 * Pruebas E2E de la Fase 5: servidor MCP (Model Context Protocol) del
 * BackOffice.
 *
 * Cubre:
 *  1. El transporte HTTP (Streamable HTTP) montado en `/mcp` del backend:
 *     rechaza peticiones sin token (401) y de vendedores (403); con token de
 *     administrador completa el saludo MCP y lista las 13 herramientas.
 *  2. Las herramientas contra datos reales, creados y borrados por la suite:
 *     resumen_backoffice, listar_usuarios, suspender/reactivar_usuario
 *     (con el id numérico de PostgreSQL), reportes (listar y resolver),
 *     lista negra (alta, listado y baja), historial_transacciones,
 *     auditar_chat_venta, listar_informes_globales y generar_informes.
 *  3. El transporte stdio (`npm run mcp`): el cliente MCP lanza el proceso,
 *     negocia el protocolo y ejecuta herramientas igual que por HTTP.
 *
 * Levanta un backend de prueba en el puerto 5101 y usa directamente
 * PostgreSQL/MongoDB locales (mismos que el backend de desarrollo). Crea
 * cuentas y datos de prueba y los elimina al terminar.
 *
 * Uso (con MongoDB y PostgreSQL locales corriendo):
 *   node --harmony-temporal --import tsx scripts/probar-mcp.ts
 */
import "dotenv/config";
import { spawn, type ChildProcess } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import clientePrisma from "../src/configuracion/prisma.js";
import { Usuario } from "../src/models/usuario.js";
import { ListaNegra } from "../src/models/ListaNegra.js";
import { Sancion } from "../src/models/Sancion.js";
import { InformeGlobal } from "../src/models/InformeGlobal.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(__dirname, "..");

const PUERTO_BACKEND = 5101;
const BASE = `http://127.0.0.1:${PUERTO_BACKEND}`;
const URL_MCP = new URL(`${BASE}/mcp`);

// Correos a consola: las pruebas no envían correo real.
process.env.GMAIL_USER = "";
process.env.GMAIL_APP_PASSWORD = "";

const marca = String(Date.now()).slice(-8);
const CORREO_VENDEDOR = `vendedor.mcp.${marca}@ichiba.test`;
const PASSWORD_VENDEDOR = "McpVendedor123!";
const CORREO_ADMIN = `admin.mcp.${marca}@ichiba.test`;
const PASSWORD_ADMIN = "McpAdmin123!";
const CORREO_PAYPAL = `paypal.mcp.${marca}@ejemplo.test`;
const RFC_LISTA_NEGRA = `MCPX${marca}`;
const COMPRADOR_PRUEBA = `comprador-mcp-${marca}`;
const PERIODO_PRUEBA = "2099-01";

const HERRAMIENTAS_ESPERADAS = [
  "resumen_backoffice",
  "listar_usuarios",
  "suspender_usuario",
  "reactivar_usuario",
  "listar_reportes_pendientes",
  "resolver_reporte",
  "listar_lista_negra",
  "agregar_lista_negra",
  "quitar_lista_negra",
  "historial_transacciones",
  "auditar_chat_venta",
  "listar_informes_globales",
  "generar_informes",
];

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
      direccion: "Av. de las Pruebas 501, Centro, Ciudad de México",
      telefono: "5588888888",
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
        direccion: "Av. de las Pruebas 501, Centro, Ciudad de México",
        telefono: "5588888888",
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

/** Entorno completo para el proceso hijo stdio (con GMAIL apagado). */
function entornoParaHijo(): Record<string, string> {
  const entorno: Record<string, string> = {};
  for (const [clave, valor] of Object.entries(process.env)) {
    if (typeof valor === "string") entorno[clave] = valor;
  }
  entorno.GMAIL_USER = "";
  entorno.GMAIL_APP_PASSWORD = "";
  return entorno;
}

// ---------------------------------------------------------------------------
// Helpers del cliente MCP
// ---------------------------------------------------------------------------
type RespuestaHerramienta = {
  esError: boolean;
  texto: string;
  datos: any;
};

async function llamarHerramienta(
  cliente: Client,
  nombre: string,
  argumentos: Record<string, unknown> = {},
): Promise<RespuestaHerramienta> {
  const resultado = await cliente.callTool({
    name: nombre,
    arguments: argumentos,
  });

  const partes = Array.isArray(resultado.content) ? resultado.content : [];
  const bloque = partes.find(
    (parte) => (parte as { type?: string }).type === "text",
  ) as { text?: string } | undefined;
  const texto = bloque?.text ?? "";

  let datos: any = null;
  try {
    datos = texto ? JSON.parse(texto) : null;
  } catch {
    datos = null;
  }

  return { esError: resultado.isError === true, texto, datos };
}

async function herramientasDe(cliente: Client): Promise<string[]> {
  const listado = await cliente.listTools();
  return listado.tools.map((herramienta) => herramienta.name);
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
    nombreCompleto: `Vendedor MCP ${marca}`,
    password: PASSWORD_VENDEDOR,
    tipo: "vendedor",
    rfc: `MCPV${marca}`,
  });
  await crearCuentaDePrueba({
    correo: CORREO_ADMIN,
    nombreCompleto: `Admin MCP ${marca}`,
    password: PASSWORD_ADMIN,
    tipo: "admin",
    rfc: `MCPA${marca}`,
  });

  const tokenVendedor = await iniciarSesion(CORREO_VENDEDOR, PASSWORD_VENDEDOR);
  const tokenAdmin = await iniciarSesion(CORREO_ADMIN, PASSWORD_ADMIN);
  verificar(
    "las cuentas de prueba inician sesión (token real de la API)",
    Boolean(tokenVendedor && tokenAdmin),
    `vendedor=${Boolean(tokenVendedor)} admin=${Boolean(tokenAdmin)}`,
  );

  // -------------------------------------------------------------------------
  // 1. Control de acceso del endpoint HTTP /mcp
  // -------------------------------------------------------------------------
  const cuerpoJsonRpc = JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/list",
    params: {},
  });

  const sinToken = await fetch(URL_MCP, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: cuerpoJsonRpc,
  });
  verificar(
    "el endpoint /mcp rechaza peticiones sin token (401)",
    sinToken.status === 401,
    `status=${sinToken.status}`,
  );

  const conVendedor = await fetch(URL_MCP, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokenVendedor}`,
    },
    body: cuerpoJsonRpc,
  });
  verificar(
    "el endpoint /mcp rechaza a un vendedor: solo administradores (403)",
    conVendedor.status === 403,
    `status=${conVendedor.status}`,
  );

  // -------------------------------------------------------------------------
  // 2. Cliente MCP por HTTP con token de administrador
  // -------------------------------------------------------------------------
  const clienteHttp = new Client({ name: "prueba-ichiba", version: "1.0.0" });
  const transporteHttp = new StreamableHTTPClientTransport(URL_MCP, {
    requestInit: {
      headers: { Authorization: `Bearer ${tokenAdmin}` },
    },
  });
  await clienteHttp.connect(transporteHttp);

  const nombresHttp = await herramientasDe(clienteHttp);
  verificar(
    "el saludo MCP por HTTP lista las 13 herramientas del BackOffice",
    HERRAMIENTAS_ESPERADAS.every((nombre) => nombresHttp.includes(nombre)) &&
      nombresHttp.length >= HERRAMIENTAS_ESPERADAS.length,
    `herramientas=${nombresHttp.join(", ")}`,
  );

  // --- resumen_backoffice ----------------------------------------------------
  const resumen = await llamarHerramienta(clienteHttp, "resumen_backoffice");
  verificar(
    "resumen_backoffice devuelve el dashboard completo",
    !resumen.esError &&
      typeof resumen.datos?.generadoEn === "string" &&
      resumen.datos?.usuarios?.total >= 2 &&
      typeof resumen.datos?.ventas?.total === "number",
    resumen.esError ? resumen.texto : JSON.stringify(resumen.datos?.usuarios),
  );

  // --- listar_usuarios con búsqueda -------------------------------------------
  const listadoUsuarios = await llamarHerramienta(clienteHttp, "listar_usuarios", {
    busqueda: CORREO_VENDEDOR,
  });
  verificar(
    "listar_usuarios encuentra a la cuenta por su correo",
    !listadoUsuarios.esError &&
      Array.isArray(listadoUsuarios.datos?.usuarios) &&
      listadoUsuarios.datos.usuarios.some(
        (usuario: any) => usuario.correo === CORREO_VENDEDOR,
      ),
    listadoUsuarios.esError
      ? listadoUsuarios.texto
      : JSON.stringify(listadoUsuarios.datos),
  );

  // --- suspender / reactivar con el id numérico de PostgreSQL -----------------
  const suspender = await llamarHerramienta(clienteHttp, "suspender_usuario", {
    id_usuario: String(idVendedor),
  });
  const espejoSuspendido = await Usuario.findOne({
    correo: CORREO_VENDEDOR,
  }).lean();
  verificar(
    "suspender_usuario (id numérico de PostgreSQL) suspende la cuenta real",
    !suspender.esError &&
      suspender.datos?.suspendido === true &&
      espejoSuspendido?.suspendido === true,
    suspender.esError
      ? suspender.texto
      : `espejo.suspendido=${espejoSuspendido?.suspendido}`,
  );

  const reactivar = await llamarHerramienta(clienteHttp, "reactivar_usuario", {
    id_usuario: String(idVendedor),
  });
  const espejoReactivado = await Usuario.findOne({
    correo: CORREO_VENDEDOR,
  }).lean();
  verificar(
    "reactivar_usuario vuelve a habilitar la cuenta",
    !reactivar.esError &&
      reactivar.datos?.suspendido === false &&
      espejoReactivado?.suspendido === false,
    reactivar.esError
      ? reactivar.texto
      : `espejo.suspendido=${espejoReactivado?.suspendido}`,
  );

  // --- reportes: listar pendientes y resolver --------------------------------
  let idReporte = 0;
  try {
    const creacion = await fetch(`${BASE}/api/reportes`, {
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
        detalle: "Reporte de prueba del MCP (se elimina al terminar)",
      }),
    });
    if (!creacion.ok) {
      throw new Error(`POST /api/reportes respondió ${creacion.status}`);
    }

    const reporte = await clientePrisma.reporte.findFirst({
      where: { vendedorId: idVendedor },
      orderBy: { createdAt: "desc" },
    });
    idReporte = reporte ? Number(reporte.id) : 0;
    verificar(
      "el reporte de prueba se creó por REST para probar las herramientas",
      idReporte > 0,
      `idReporte=${idReporte}`,
    );

    const pendientes = await llamarHerramienta(
      clienteHttp,
      "listar_reportes_pendientes",
    );
    const enBandeja = Array.isArray(pendientes.datos)
      ? pendientes.datos.some((fila: any) => Number(fila.id) === idReporte)
      : false;
    verificar(
      "listar_reportes_pendientes incluye el reporte recién creado",
      !pendientes.esError && enBandeja,
      pendientes.esError
        ? pendientes.texto
        : JSON.stringify(pendientes.datos).slice(0, 200),
    );

    const resolucion = await llamarHerramienta(clienteHttp, "resolver_reporte", {
      id_reporte: idReporte,
      resultado: "rechazado",
    });
    verificar(
      "resolver_reporte rechaza el reporte y responde el estado final",
      !resolucion.esError && resolucion.datos?.estado === "rechazado",
      resolucion.esError ? resolucion.texto : JSON.stringify(resolucion.datos),
    );

    const pendientesDespues = await llamarHerramienta(
      clienteHttp,
      "listar_reportes_pendientes",
    );
    const sigueEnBandeja = Array.isArray(pendientesDespues.datos)
      ? pendientesDespues.datos.some(
          (fila: any) => Number(fila.id) === idReporte,
        )
      : true;
    verificar(
      "el reporte resuelto desaparece de la bandeja",
      !pendientesDespues.esError && !sigueEnBandeja,
      pendientesDespues.esError ? pendientesDespues.texto : "",
    );
  } finally {
    if (idReporte === 0) {
      const reporte = await clientePrisma.reporte.findFirst({
        where: { vendedorId: idVendedor },
        orderBy: { createdAt: "desc" },
      });
      idReporte = reporte ? Number(reporte.id) : 0;
    }
  }

  // --- lista negra: alta, listado y baja --------------------------------------
  const alta = await llamarHerramienta(clienteHttp, "agregar_lista_negra", {
    rfc: RFC_LISTA_NEGRA,
    nombre_completo: `Persona de prueba MCP ${marca}`,
    motivo: "Prueba del MCP (se elimina al terminar)",
  });
  const idEntrada = String(alta.datos?.id ?? "");
  verificar(
    "agregar_lista_negra veta a la persona y responde la entrada creada",
    !alta.esError && idEntrada.length === 24 && alta.datos?.rfc === RFC_LISTA_NEGRA,
    alta.esError ? alta.texto : JSON.stringify(alta.datos),
  );

  const listadoNegra = await llamarHerramienta(clienteHttp, "listar_lista_negra", {
    pagina: 1,
    por_pagina: 50,
  });
  const enListaNegra = Array.isArray(listadoNegra.datos?.entradas)
    ? listadoNegra.datos.entradas.some((entrada: any) => entrada.id === idEntrada)
    : false;
  verificar(
    "listar_lista_negra muestra la entrada recién agregada",
    !listadoNegra.esError && enListaNegra,
    listadoNegra.esError ? listadoNegra.texto : "",
  );

  const baja = await llamarHerramienta(clienteHttp, "quitar_lista_negra", {
    id_entrada: idEntrada,
  });
  const entradaBorrada = await ListaNegra.findOne({ rfc: RFC_LISTA_NEGRA }).lean();
  verificar(
    "quitar_lista_negra elimina la entrada de verdad",
    !baja.esError && entradaBorrada === null,
    baja.esError ? baja.texto : `encontrada=${Boolean(entradaBorrada)}`,
  );

  // --- historial y auditoría --------------------------------------------------
  const historial = await llamarHerramienta(
    clienteHttp,
    "historial_transacciones",
  );
  verificar(
    "historial_transacciones responde la lista de filas, ventas y reportes",
    !historial.esError && Array.isArray(historial.datos),
    historial.esError ? historial.texto : `entradas=${historial.datos?.length}`,
  );

  const chatInexistente = await llamarHerramienta(
    clienteHttp,
    "auditar_chat_venta",
    { id_venta: "000000000000000000000000" },
  );
  verificar(
    "auditar_chat_venta responde error claro si la venta no existe",
    chatInexistente.esError && chatInexistente.texto.includes("Venta no encontrada"),
    chatInexistente.texto,
  );

  // --- informes globales -------------------------------------------------------
  const informes = await llamarHerramienta(
    clienteHttp,
    "listar_informes_globales",
  );
  verificar(
    "listar_informes_globales responde el historial de informes",
    !informes.esError && Array.isArray(informes.datos),
    informes.esError ? informes.texto : `informes=${informes.datos?.length}`,
  );

  const generacion = await llamarHerramienta(clienteHttp, "generar_informes", {
    periodo: PERIODO_PRUEBA,
  });
  verificar(
    `generar_informes genera el período ${PERIODO_PRUEBA} (sin datos)`,
    !generacion.esError && generacion.datos?.periodo === PERIODO_PRUEBA,
    generacion.esError ? generacion.texto : JSON.stringify(generacion.datos),
  );

  void clienteHttp.close();

  // -------------------------------------------------------------------------
  // 3. Cliente MCP por stdio (`npm run mcp`)
  // -------------------------------------------------------------------------
  const clienteStdio = new Client({
    name: "prueba-ichiba-stdio",
    version: "1.0.0",
  });
  const transporteStdio = new StdioClientTransport({
    command: process.execPath,
    args: ["--harmony-temporal", "--import", "tsx", "src/mcp/arranqueStdio.ts"],
    cwd: RAIZ,
    env: entornoParaHijo(),
    stderr: "pipe",
  });
  transporteStdio.stderr?.on("data", (d) =>
    process.stderr.write(`[mcp:stdio] ${d}`),
  );
  await clienteStdio.connect(transporteStdio);

  const nombresStdio = await herramientasDe(clienteStdio);
  verificar(
    "el saludo MCP por stdio lista las 13 herramientas del BackOffice",
    HERRAMIENTAS_ESPERADAS.every((nombre) => nombresStdio.includes(nombre)) &&
      nombresStdio.length >= HERRAMIENTAS_ESPERADAS.length,
    `herramientas=${nombresStdio.join(", ")}`,
  );

  const resumenStdio = await llamarHerramienta(
    clienteStdio,
    "resumen_backoffice",
  );
  verificar(
    "resumen_backoffice funciona por stdio con los datos reales",
    !resumenStdio.esError &&
      typeof resumenStdio.datos?.generadoEn === "string" &&
      resumenStdio.datos?.usuarios?.total >= 2,
    resumenStdio.esError
      ? resumenStdio.texto
      : JSON.stringify(resumenStdio.datos?.usuarios),
  );

  const usuariosStdio = await llamarHerramienta(clienteStdio, "listar_usuarios", {
    busqueda: CORREO_ADMIN,
  });
  verificar(
    "listar_usuarios por stdio encuentra a la cuenta administradora",
    !usuariosStdio.esError &&
      Array.isArray(usuariosStdio.datos?.usuarios) &&
      usuariosStdio.datos.usuarios.some(
        (usuario: any) => usuario.correo === CORREO_ADMIN,
      ),
    usuariosStdio.esError ? usuariosStdio.texto : "",
  );

  void clienteStdio.close();
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
  // Limpieza: reportes y cuentas de PostgreSQL; espejos, sanciones, lista
  // negra e informes de prueba en MongoDB; backend y conexiones.
  // -------------------------------------------------------------------------
  try {
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
    await InformeGlobal.deleteMany({ periodo: PERIODO_PRUEBA });
  } catch (error) {
    console.error("[limpieza] No se pudieron borrar los datos de Mongo:", error);
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
  `\nSuite del servidor MCP del BackOffice: ${resultados.length - fallas.length}/${resultados.length} pruebas pasaron`,
);
if (fallas.length > 0) {
  console.log("Fallas:");
  for (const falla of fallas) console.log(` - ${falla.nombre}: ${falla.detalle}`);
  process.exit(1);
}
process.exit(0);
