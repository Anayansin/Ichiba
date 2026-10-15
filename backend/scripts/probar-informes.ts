/**
 * Pruebas E2E de RQF13, RQNF13.1, RQNF13.2, RQNF13.3, RQF14, RQNF14,
 * RQNF14.1 y RQNF14.2 (KO9.1): informes mensuales de ventas.
 *
 * Cubre:
 *  1. La generación del informe de cada vendedor con actividad: total de
 *     ventas del período, ingresos, productos vendidos, filas virtuales
 *     iniciadas, ventas concluidas, tasa de concertación (KO6.1) y tiempo
 *     promedio por fila (RQNF13.1 / RQNF13.2).
 *  2. El informe global del administrador: categoría más vendida, desempate
 *     con el mes anterior, empate persistente sin ganador y tasa de abandono
 *     de fila por categoría (RQF14 / RQNF14 / RQNF14.2).
 *  3. La consulta del historial y la descarga en PDF para el vendedor y para
 *     el administrador, con permisos por rol (RQNF13.3).
 *  4. La purga permanente de reportes e informes con 13 meses de antigüedad,
 *     el día 1° del mes en que cumplen (RQNF14.1).
 *  5. El trabajo mensual `ejecutarRevisionMensual` (generación + purga).
 *
 * Levanta un backend de prueba en el puerto 5099 y usa directamente
 * PostgreSQL/MongoDB locales (mismos que el backend de desarrollo). Las
 * transacciones históricas se crean con fechas de 2019 para no chocar con los
 * datos vivos del proyecto.
 *
 * Uso (con MongoDB y PostgreSQL locales corriendo):
 *   node --harmony-temporal --import tsx scripts/probar-informes.ts
 */
import "dotenv/config";
import { spawn, type ChildProcess } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import clientePrisma from "../src/configuracion/prisma.js";
import { Producto } from "../src/models/producto.js";
import { Usuario } from "../src/models/usuario.js";
import { InformeVendedor } from "../src/models/InformeVendedor.js";
import { InformeGlobal } from "../src/models/InformeGlobal.js";
import {
  esPeriodoValido,
  periodoDeFecha,
  purgarReportesEInformesAntiguos,
  sumarPeriodos,
} from "../src/services/informesService.js";
import { ejecutarRevisionMensual } from "../src/jobs/informesMensuales.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(__dirname, "..");

const PUERTO_BACKEND = 5099;
const BASE = `http://127.0.0.1:${PUERTO_BACKEND}`;

// Correos a consola: las pruebas no envían correo real.
process.env.GMAIL_USER = "";
process.env.GMAIL_APP_PASSWORD = "";

const marca = String(Date.now()).slice(-8);
const CORREO_VENDEDOR = `vendedor.informes.${marca}@ichiba.test`;
const PASSWORD_VENDEDOR = "InformesIchiba123!";
const CORREO_VENDEDOR_DOS = `vendedor.sinactividad.${marca}@ichiba.test`;
const PASSWORD_VENDEDOR_DOS = "InformesIchiba456!";
const CORREO_ADMIN = `admin.informes.${marca}@ichiba.test`;
const PASSWORD_ADMIN = "AdminInformes123!";
const CORREO_PAYPAL = `paypal.informes.${marca}@ejemplo.test`;

// Períodos históricos de prueba (sin datos vivos del proyecto).
const PERIODO_A = "2019-05"; // informe del vendedor + global con ganador claro
const PERIODO_B = "2019-04"; // empate resuelto con el mes anterior
const PERIODO_B_PREVIO = "2019-03";
const PERIODO_C = "2019-02"; // empate persistente: sin ganador
const PERIODO_C_PREVIO = "2019-01";
const PERIODOS_DE_PRUEBA = [
  PERIODO_A,
  PERIODO_B,
  PERIODO_B_PREVIO,
  PERIODO_C,
  PERIODO_C_PREVIO,
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
// Helpers de fechas
// ---------------------------------------------------------------------------
function fechaUTC(periodo: string, dia: number, hora = 12, minuto = 0): Date {
  const [anio, mes] = periodo.split("-").map(Number);
  return new Date(Date.UTC(anio, mes - 1, dia, hora, minuto));
}

// ---------------------------------------------------------------------------
// Infraestructura del backend de prueba
// ---------------------------------------------------------------------------
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
const productosCreados: string[] = [];
const ventasCreadas: number[] = [];
const reportesCreados: number[] = [];
// Períodos cuyos informes debe borrar la limpieza (se amplía con los de la
// prueba de purga RQNF14.1).
const periodosDeLimpieza: string[] = [...PERIODOS_DE_PRUEBA];

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

async function pedir(ruta: string, token?: string) {
  return fetch(`${BASE}${ruta}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

async function mensajeDe(r: Response): Promise<string> {
  try {
    const j = (await r.json()) as { message?: string };
    return j.message ?? JSON.stringify(j);
  } catch {
    return "(sin JSON)";
  }
}

async function esPdf(r: Response): Promise<boolean> {
  const buffer = Buffer.from(await r.arrayBuffer());
  return buffer.subarray(0, 4).toString() === "%PDF";
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
      direccion: "Av. de las Pruebas 200, Centro, Ciudad de México",
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
        direccion: "Av. de las Pruebas 200, Centro, Ciudad de México",
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

async function crearProductoDePrueba(opciones: {
  nombre: string;
  categoria: string;
  vendedorId: number;
}): Promise<string> {
  const producto = await Producto.create({
    nombre: opciones.nombre,
    precio: 100,
    imagenes: [],
    categoria: opciones.categoria,
    descripcion: "Producto de prueba de los informes mensuales (RQF13/RQF14).",
    vendedor: `Vendedor Informes ${marca}`,
    vendedorId: String(opciones.vendedorId),
    condicion: "usado-buen-estado",
    condicionUso: "usado-buen-estado",
    metodoEntrega: "punto-encuentro",
    horarioEntregaInicio: "09:00",
    horarioEntregaFin: "18:00",
    tiempoLimitePago: 60,
    activo: true,
  });
  productosCreados.push(String(producto._id));
  return String(producto._id);
}

let secuenciaPago = 0;

async function crearVentaCompletada(opciones: {
  productoId: string;
  vendedorId: number;
  compradorId: string;
  monto: number;
  entregadoEn: Date;
  categoria: string;
  nombreProducto: string;
}): Promise<number> {
  const creada = await clientePrisma.venta.create({
    data: {
      productoId: opciones.productoId,
      vendedorId: opciones.vendedorId,
      compradorId: opciones.compradorId,
      monto: opciones.monto,
      paypalOrderId: `INF-${marca}-${++secuenciaPago}`,
      estado: "completada",
      entregadoEn: opciones.entregadoEn,
      productoCategoria: opciones.categoria,
      productoNombre: opciones.nombreProducto,
    },
  });
  ventasCreadas.push(Number(creada.id));
  return Number(creada.id);
}

async function crearVentaEnEntrega(opciones: {
  productoId: string;
  vendedorId: number;
  compradorId: string;
  monto: number;
}): Promise<number> {
  const creada = await clientePrisma.venta.create({
    data: {
      productoId: opciones.productoId,
      vendedorId: opciones.vendedorId,
      compradorId: opciones.compradorId,
      monto: opciones.monto,
      paypalOrderId: `INF-${marca}-${++secuenciaPago}`,
      estado: "en_entrega",
    },
  });
  ventasCreadas.push(Number(creada.id));
  return Number(creada.id);
}

let posicionCola = 0;

async function crearFilaDePrueba(opciones: {
  productoId: string;
  compradorId: string;
  estado: string;
  motivoCierre?: string | null;
  creadaEn: Date;
  cerradaEn?: Date;
}): Promise<number> {
  const creada = await clientePrisma.cola.create({
    data: {
      productoId: opciones.productoId,
      compradorId: opciones.compradorId,
      correo: `${opciones.compradorId}@ejemplo.test`,
      posicion: ++posicionCola,
      estado: opciones.estado,
      motivoCierre: opciones.motivoCierre ?? null,
      createdAt: opciones.creadaEn,
      ...(opciones.cerradaEn ? { updatedAt: opciones.cerradaEn } : {}),
    },
  });
  return Number(creada.id);
}

async function crearReporteDePrueba(opciones: {
  vendedorId: number;
  creadoEn: Date;
}): Promise<number> {
  const creado = await clientePrisma.reporte.create({
    data: {
      sujetoTipo: "vendedor",
      sujetoId: String(opciones.vendedorId),
      reportadoPorTipo: "comprador",
      reportadoPorId: `comprador-reporte-${marca}`,
      elemento: "producto",
      categoria: "otro",
      categoriaNombre: "Otro",
      tipoFalta: "leve",
      detalle: "Reporte de prueba para la purga RQNF14.1.",
      estado: "pendiente",
      vendedorId: opciones.vendedorId,
      createdAt: opciones.creadoEn,
    },
  });
  reportesCreados.push(Number(creado.id));
  return Number(creado.id);
}

// ---------------------------------------------------------------------------
// Pruebas
// ---------------------------------------------------------------------------
const hijos: ChildProcess[] = [];
try {
  await mongoose.connect(process.env.MONGO_URI as string);

  // -------------------------------------------------------------------------
  // RQNF14.1: purga de reportes e informes con 13 meses de antigüedad.
  // Se prueba antes de arrancar el backend para que la recuperación de
  // arranque del job no compita con estos registros de prueba.
  // -------------------------------------------------------------------------
  const AHORA_PURGA = new Date("2026-10-15T12:00:00Z");
  const periodoAPurgar = sumarPeriodos(periodoDeFecha(AHORA_PURGA), -13);
  const periodoPurgarSiguiente = sumarPeriodos(periodoAPurgar, 1);
  const periodoPurgarAnterior = sumarPeriodos(periodoAPurgar, -1);
  periodosDeLimpieza.push(
    periodoAPurgar,
    periodoPurgarSiguiente,
    periodoPurgarAnterior,
  );

  // Los reportes de prueba necesitan un vendedor existente (llave foránea).
  const vendedorPurgaId = await crearCuentaDePrueba({
    correo: `vendedor.purga.${marca}@ichiba.test`,
    nombreCompleto: "Vendedor Purga Informes",
    password: "PurgaIchiba123!",
    tipo: "vendedor",
    rfc: `IP${marca}PUR`,
  });

  const reporteAntiguoId = await crearReporteDePrueba({
    vendedorId: vendedorPurgaId,
    creadoEn: fechaUTC(periodoAPurgar, 15, 10),
  });
  const reporteRecienteId = await crearReporteDePrueba({
    vendedorId: vendedorPurgaId,
    creadoEn: fechaUTC(periodoDeFecha(AHORA_PURGA), 10, 10),
  });

  await InformeVendedor.create({
    vendedorId: String(vendedorPurgaId),
    periodo: periodoAPurgar,
    totalVentas: 1,
  });
  await InformeVendedor.create({
    vendedorId: String(vendedorPurgaId),
    periodo: periodoPurgarSiguiente,
    totalVentas: 1,
  });
  await InformeGlobal.create({
    periodo: periodoAPurgar,
    empate: false,
  });
  await InformeGlobal.create({
    periodo: periodoPurgarAnterior,
    empate: false,
  });

  const purga = await purgarReportesEInformesAntiguos(AHORA_PURGA);
  const reporteAntiguo = await clientePrisma.reporte.findUnique({
    where: { id: reporteAntiguoId },
  });
  const reporteReciente = await clientePrisma.reporte.findUnique({
    where: { id: reporteRecienteId },
  });

  verificar(
    "RQNF14.1 la purga elimina los reportes del mes M-13 y conserva los recientes",
    purga.periodo === periodoAPurgar &&
      purga.reportes >= 1 &&
      reporteAntiguo === null &&
      reporteReciente !== null,
    `periodo=${purga.periodo} reportes=${purga.reportes} antiguo=${reporteAntiguo === null} reciente=${reporteReciente !== null}`,
  );

  const informeVendedorViejo = await InformeVendedor.findOne({
    vendedorId: String(vendedorPurgaId),
    periodo: periodoAPurgar,
  }).lean();
  const informeVendedorNuevo = await InformeVendedor.findOne({
    vendedorId: String(vendedorPurgaId),
    periodo: periodoPurgarSiguiente,
  }).lean();
  const informeGlobalViejo = await InformeGlobal.findOne({
    periodo: periodoAPurgar,
  }).lean();
  const informeGlobalNuevo = await InformeGlobal.findOne({
    periodo: periodoPurgarAnterior,
  }).lean();

  verificar(
    "RQNF14.1 la purga elimina los informes de vendedor y globales del período M-13",
    purga.informesVendedor === 1 &&
      purga.informesGlobales === 1 &&
      informeVendedorViejo === null &&
      informeVendedorNuevo !== null &&
      informeGlobalViejo === null &&
      informeGlobalNuevo !== null,
    `vendedor=${purga.informesVendedor} global=${purga.informesGlobales}`,
  );

  // -------------------------------------------------------------------------
  // Ayudantes de período.
  // -------------------------------------------------------------------------
  verificar(
    "RQNF13.1 esPeriodoValido acepta AAAA-MM y rechaza otros formatos",
    esPeriodoValido("2026-01") &&
      esPeriodoValido("2019-12") &&
      !esPeriodoValido("2026-13") &&
      !esPeriodoValido("2026-1") &&
      !esPeriodoValido("hola") &&
      !esPeriodoValido(null),
    "validación de períodos incorrecta",
  );
  verificar(
    "RQNF14.1 sumarPeriodos cruza correctamente los años",
    sumarPeriodos("2026-01", -1) === "2025-12" &&
      sumarPeriodos("2025-12", 13) === "2027-01",
    "aritmética de períodos incorrecta",
  );

  // -------------------------------------------------------------------------
  // Arranque del backend y cuentas de prueba.
  // -------------------------------------------------------------------------
  console.log("Arrancando el backend de prueba…");
  const backend = arrancarBackend();
  hijos.push(backend);
  await esperarSalud(PUERTO_BACKEND);
  // Margen para que termine la recuperación de arranque del job de informes.
  await new Promise((r) => setTimeout(r, 5000));

  const vendedorId = await crearCuentaDePrueba({
    correo: CORREO_VENDEDOR,
    nombreCompleto: "Vendedor Informes Prueba",
    password: PASSWORD_VENDEDOR,
    tipo: "vendedor",
    rfc: `IF${marca}ABC`,
  });
  const vendedorDosId = await crearCuentaDePrueba({
    correo: CORREO_VENDEDOR_DOS,
    nombreCompleto: "Vendedor Sin Actividad",
    password: PASSWORD_VENDEDOR_DOS,
    tipo: "vendedor",
    rfc: `IS${marca}ABC`,
  });
  const adminId = await crearCuentaDePrueba({
    correo: CORREO_ADMIN,
    nombreCompleto: "Administrador Informes Prueba",
    password: PASSWORD_ADMIN,
    tipo: "admin",
    rfc: `AI${marca}ABC`,
  });

  const tokenVendedor = await iniciarSesion(CORREO_VENDEDOR, PASSWORD_VENDEDOR);
  const tokenVendedorDos = await iniciarSesion(
    CORREO_VENDEDOR_DOS,
    PASSWORD_VENDEDOR_DOS,
  );
  const tokenAdmin = await iniciarSesion(CORREO_ADMIN, PASSWORD_ADMIN);
  verificar(
    "Cuentas de prueba disponibles (login por su espejo de MongoDB)",
    !!tokenVendedor && !!tokenVendedorDos && !!tokenAdmin,
    `vendedor=${!!tokenVendedor} vendedor2=${!!tokenVendedorDos} admin=${!!tokenAdmin}`,
  );

  // -------------------------------------------------------------------------
  // Datos del período A: informe del vendedor y global con ganador claro.
  // -------------------------------------------------------------------------
  const productoHogar = await crearProductoDePrueba({
    nombre: "Jarrón de barro (informes)",
    categoria: "Hogar",
    vendedorId,
  });
  const productoRopa = await crearProductoDePrueba({
    nombre: "Chamarra bordada (informes)",
    categoria: "Ropa",
    vendedorId,
  });

  // Ventas concluidas dentro del período A: 2 de Hogar ($100 + $250) y 1 de
  // Ropa ($80) = 3 ventas e ingresos de $430 (RQNF13.1).
  await crearVentaCompletada({
    productoId: productoHogar,
    vendedorId,
    compradorId: `comprador-informes-uno-${marca}`,
    monto: 100,
    entregadoEn: fechaUTC(PERIODO_A, 7, 15),
    categoria: "Hogar",
    nombreProducto: "Jarrón de barro (informes)",
  });
  await crearVentaCompletada({
    productoId: productoHogar,
    vendedorId,
    compradorId: `comprador-informes-dos-${marca}`,
    monto: 250,
    entregadoEn: fechaUTC(PERIODO_A, 8, 15),
    categoria: "Hogar",
    nombreProducto: "Jarrón de barro (informes)",
  });
  await crearVentaCompletada({
    productoId: productoRopa,
    vendedorId,
    compradorId: `comprador-informes-tres-${marca}`,
    monto: 80,
    entregadoEn: fechaUTC(PERIODO_A, 9, 15),
    categoria: "Ropa",
    nombreProducto: "Chamarra bordada (informes)",
  });
  // Transacción en curso: no debe contarse (RQNF13.1).
  await crearVentaEnEntrega({
    productoId: productoRopa,
    vendedorId,
    compradorId: `comprador-informes-cuatro-${marca}`,
    monto: 999,
  });
  // Transacción concluida fuera del período: tampoco debe contarse.
  await crearVentaCompletada({
    productoId: productoRopa,
    vendedorId,
    compradorId: `comprador-informes-cinco-${marca}`,
    monto: 500,
    entregadoEn: fechaUTC("2019-06", 10, 15),
    categoria: "Ropa",
    nombreProducto: "Chamarra bordada (informes)",
  });

  // Filas del período A (RQNF13.2 / RQNF14.2):
  //   Hogar: 3 iniciadas, 1 abandonada (salió), 1 cerrada por venta.
  //   Ropa:  2 iniciadas, 1 abandonada (turno vencido), 1 cerrada por venta.
  //   Tiempos de cierre: 60 + 30 + 120 + 30 = 240 min / 4 = 60 min.
  await crearFilaDePrueba({
    productoId: productoHogar,
    compradorId: `comprador-informes-uno-${marca}`,
    estado: "finalizada",
    motivoCierre: "venta_completada",
    creadaEn: fechaUTC(PERIODO_A, 2, 10),
    cerradaEn: fechaUTC(PERIODO_A, 2, 11),
  });
  await crearFilaDePrueba({
    productoId: productoHogar,
    compradorId: `comprador-informes-dos-${marca}`,
    estado: "finalizada",
    motivoCierre: "salio_voluntariamente",
    creadaEn: fechaUTC(PERIODO_A, 3, 9),
    cerradaEn: fechaUTC(PERIODO_A, 3, 9, 30),
  });
  await crearFilaDePrueba({
    productoId: productoHogar,
    compradorId: `comprador-informes-tres-${marca}`,
    estado: "activa",
    creadaEn: fechaUTC(PERIODO_A, 4, 9),
  });
  await crearFilaDePrueba({
    productoId: productoRopa,
    compradorId: `comprador-informes-cuatro-${marca}`,
    estado: "finalizada",
    motivoCierre: "turno_vencido",
    creadaEn: fechaUTC(PERIODO_A, 5, 8),
    cerradaEn: fechaUTC(PERIODO_A, 5, 10),
  });
  await crearFilaDePrueba({
    productoId: productoRopa,
    compradorId: `comprador-informes-cinco-${marca}`,
    estado: "finalizada",
    motivoCierre: "venta_completada",
    creadaEn: fechaUTC(PERIODO_A, 6, 12),
    cerradaEn: fechaUTC(PERIODO_A, 6, 12, 30),
  });

  // -------------------------------------------------------------------------
  // Datos del período B: empate en el mes, desempate con el mes anterior.
  // -------------------------------------------------------------------------
  await crearVentaCompletada({
    productoId: productoHogar,
    vendedorId,
    compradorId: `comprador-informes-b-uno-${marca}`,
    monto: 10,
    entregadoEn: fechaUTC(PERIODO_B, 5, 15),
    categoria: "Hogar",
    nombreProducto: "Jarrón de barro (informes)",
  });
  await crearVentaCompletada({
    productoId: productoRopa,
    vendedorId,
    compradorId: `comprador-informes-b-dos-${marca}`,
    monto: 20,
    entregadoEn: fechaUTC(PERIODO_B, 6, 15),
    categoria: "Ropa",
    nombreProducto: "Chamarra bordada (informes)",
  });
  // Mes anterior: Ropa vendió 2 y Hogar 0 → Ropa gana el desempate (RQNF14.2).
  await crearVentaCompletada({
    productoId: productoRopa,
    vendedorId,
    compradorId: `comprador-informes-b-tres-${marca}`,
    monto: 5,
    entregadoEn: fechaUTC(PERIODO_B_PREVIO, 5, 15),
    categoria: "Ropa",
    nombreProducto: "Chamarra bordada (informes)",
  });
  await crearVentaCompletada({
    productoId: productoRopa,
    vendedorId,
    compradorId: `comprador-informes-b-cuatro-${marca}`,
    monto: 5,
    entregadoEn: fechaUTC(PERIODO_B_PREVIO, 6, 15),
    categoria: "Ropa",
    nombreProducto: "Chamarra bordada (informes)",
  });

  // -------------------------------------------------------------------------
  // Datos del período C: empate que persiste en el mes anterior → sin
  // ganador (RQNF14.2).
  // -------------------------------------------------------------------------
  await crearVentaCompletada({
    productoId: productoHogar,
    vendedorId,
    compradorId: `comprador-informes-c-uno-${marca}`,
    monto: 10,
    entregadoEn: fechaUTC(PERIODO_C, 5, 15),
    categoria: "Hogar",
    nombreProducto: "Jarrón de barro (informes)",
  });
  await crearVentaCompletada({
    productoId: productoRopa,
    vendedorId,
    compradorId: `comprador-informes-c-dos-${marca}`,
    monto: 10,
    entregadoEn: fechaUTC(PERIODO_C, 6, 15),
    categoria: "Ropa",
    nombreProducto: "Chamarra bordada (informes)",
  });
  await crearVentaCompletada({
    productoId: productoHogar,
    vendedorId,
    compradorId: `comprador-informes-c-tres-${marca}`,
    monto: 10,
    entregadoEn: fechaUTC(PERIODO_C_PREVIO, 5, 15),
    categoria: "Hogar",
    nombreProducto: "Jarrón de barro (informes)",
  });
  await crearVentaCompletada({
    productoId: productoHogar,
    vendedorId,
    compradorId: `comprador-informes-c-cuatro-${marca}`,
    monto: 10,
    entregadoEn: fechaUTC(PERIODO_C_PREVIO, 6, 15),
    categoria: "Hogar",
    nombreProducto: "Jarrón de barro (informes)",
  });
  await crearVentaCompletada({
    productoId: productoRopa,
    vendedorId,
    compradorId: `comprador-informes-c-cinco-${marca}`,
    monto: 10,
    entregadoEn: fechaUTC(PERIODO_C_PREVIO, 5, 15),
    categoria: "Ropa",
    nombreProducto: "Chamarra bordada (informes)",
  });
  await crearVentaCompletada({
    productoId: productoRopa,
    vendedorId,
    compradorId: `comprador-informes-c-seis-${marca}`,
    monto: 10,
    entregadoEn: fechaUTC(PERIODO_C_PREVIO, 6, 15),
    categoria: "Ropa",
    nombreProducto: "Chamarra bordada (informes)",
  });

  // -------------------------------------------------------------------------
  // RQNF13.2 / RQNF14: el trabajo mensual genera el informe del mes anterior
  // y aplica la purga. Se le inyecta una fecha para que el "mes anterior" sea
  // el período A de las pruebas.
  // -------------------------------------------------------------------------
  const accionesJob = await ejecutarRevisionMensual(
    new Date("2019-06-10T12:00:00Z"),
  );
  verificar(
    "RQNF13.2 el trabajo mensual genera el informe del mes anterior y aplica la purga",
    accionesJob.length === 2 &&
      accionesJob[0].includes(PERIODO_A) &&
      accionesJob[1].includes("2018-05"),
    `acciones=${JSON.stringify(accionesJob)}`,
  );

  // --- Informe del vendedor (RQNF13.1 / RQNF13.2) --------------------------
  const informeVendedor = await InformeVendedor.findOne({
    vendedorId: String(vendedorId),
    periodo: PERIODO_A,
  }).lean();

  const productoHogarInforme = (informeVendedor?.productosVendidos ?? []).find(
    (producto: any) => String(producto.productoId) === productoHogar,
  );
  const productoRopaInforme = (informeVendedor?.productosVendidos ?? []).find(
    (producto: any) => String(producto.productoId) === productoRopa,
  );

  verificar(
    "RQNF13.1 el informe del vendedor registra ventas, ingresos y productos vendidos del período",
    informeVendedor?.totalVentas === 3 &&
      informeVendedor?.ingresos === 430 &&
      informeVendedor?.ventasConcluidas === 3 &&
      (informeVendedor?.productosVendidos ?? []).length === 2 &&
      productoHogarInforme?.cantidad === 2 &&
      productoHogarInforme?.monto === 350 &&
      productoRopaInforme?.cantidad === 1 &&
      productoRopaInforme?.monto === 80,
    `totalVentas=${informeVendedor?.totalVentas} ingresos=${informeVendedor?.ingresos} productos=${JSON.stringify(informeVendedor?.productosVendidos)}`,
  );
  verificar(
    "RQNF13.1 el informe no cuenta transacciones en curso ni de otros períodos",
    informeVendedor?.ingresos !== 1499 &&
      !(informeVendedor?.productosVendidos ?? []).some(
        (producto: any) => producto.monto === 999 || producto.monto === 500,
      ),
    "se colaron transacciones fuera del período",
  );
  verificar(
    "RQNF13.2 el informe del vendedor calcula filas iniciadas, tasa de concertación y tiempo promedio por fila (KO6.1)",
    informeVendedor?.filasIniciadas === 5 &&
      informeVendedor?.tasaConcertacion === 60 &&
      informeVendedor?.tiempoPromedioFilaMinutos === 60,
    `filas=${informeVendedor?.filasIniciadas} tasa=${informeVendedor?.tasaConcertacion} tiempo=${informeVendedor?.tiempoPromedioFilaMinutos}`,
  );
  verificar(
    "RQNF13.2 los vendedores sin actividad en el mes no reciben informe",
    (await InformeVendedor.countDocuments({
      vendedorId: String(vendedorDosId),
    })) === 0,
    "el vendedor sin actividad tiene informes",
  );

  // --- Informe global (RQF14 / RQNF14.2) -----------------------------------
  const globalA = await InformeGlobal.findOne({ periodo: PERIODO_A }).lean();
  const categoriaHogar = (globalA?.porCategoria ?? []).find(
    (categoria: any) => categoria.categoria === "Hogar",
  );
  const categoriaRopa = (globalA?.porCategoria ?? []).find(
    (categoria: any) => categoria.categoria === "Ropa",
  );

  verificar(
    "RQF14 el informe global declara la categoría más vendida del período",
    globalA?.categoriaMasVendida?.categoria === "Hogar" &&
      globalA?.categoriaMasVendida?.ventas === 2 &&
      globalA?.empate === false,
    `ganadora=${JSON.stringify(globalA?.categoriaMasVendida)} empate=${globalA?.empate}`,
  );
  verificar(
    "RQNF14.2 el informe global calcula la tasa de abandono de fila por categoría (KO9.1)",
    categoriaHogar?.ventas === 2 &&
      categoriaHogar?.filasIniciadas === 3 &&
      categoriaHogar?.filasAbandonadas === 1 &&
      categoriaHogar?.tasaAbandono === 33.3 &&
      categoriaRopa?.ventas === 1 &&
      categoriaRopa?.filasIniciadas === 2 &&
      categoriaRopa?.filasAbandonadas === 1 &&
      categoriaRopa?.tasaAbandono === 50,
    `Hogar=${JSON.stringify(categoriaHogar)} Ropa=${JSON.stringify(categoriaRopa)}`,
  );

  // -------------------------------------------------------------------------
  // RQNF13.3: historial y descarga en PDF del vendedor.
  // -------------------------------------------------------------------------
  const respuestaHistorial = await pedir("/api/informes", tokenVendedor!);
  const historial = (await respuestaHistorial.json()) as {
    informes: any[];
  };
  const informeEnHistorial = historial.informes.find(
    (informe) => informe.periodo === PERIODO_A,
  );
  verificar(
    "RQNF13.3 el vendedor consulta su historial de informes con los indicadores del mes",
    respuestaHistorial.status === 200 &&
      historial.informes.length >= 1 &&
      informeEnHistorial?.totalVentas === 3 &&
      informeEnHistorial?.ingresos === 430 &&
      informeEnHistorial?.filasIniciadas === 5 &&
      informeEnHistorial?.ventasConcluidas === 3 &&
      informeEnHistorial?.tasaConcertacion === 60 &&
      informeEnHistorial?.tiempoPromedioFilaMinutos === 60,
    `estado=${respuestaHistorial.status} informes=${JSON.stringify(historial.informes).slice(0, 300)}`,
  );

  const respuestaHistorialDos = await pedir("/api/informes", tokenVendedorDos!);
  const historialDos = (await respuestaHistorialDos.json()) as {
    informes: any[];
  };
  verificar(
    "RQNF13.3 el historial solo muestra los informes del propio vendedor",
    respuestaHistorialDos.status === 200 && historialDos.informes.length === 0,
    `estado=${respuestaHistorialDos.status} informes=${historialDos.informes.length}`,
  );

  const respuestaPdfVendedor = await pedir(
    `/api/informes/${PERIODO_A}/pdf`,
    tokenVendedor!,
  );
  verificar(
    "RQNF13.3 el informe del vendedor se descarga en PDF",
    respuestaPdfVendedor.status === 200 &&
      (respuestaPdfVendedor.headers.get("content-type") ?? "").includes(
        "application/pdf",
      ) &&
      (respuestaPdfVendedor.headers.get("content-disposition") ?? "").includes(
        `informe-ventas-${PERIODO_A}.pdf`,
      ) &&
      (await esPdf(respuestaPdfVendedor)),
    `estado=${respuestaPdfVendedor.status} tipo=${respuestaPdfVendedor.headers.get("content-type")}`,
  );

  const respuestaPdfAjeno = await pedir(
    `/api/informes/${PERIODO_A}/pdf`,
    tokenVendedorDos!,
  );
  verificar(
    "RQNF13.3 descargar un informe inexistente del propio vendedor responde 404",
    respuestaPdfAjeno.status === 404,
    `estado=${respuestaPdfAjeno.status} mensaje=${await mensajeDe(respuestaPdfAjeno)}`,
  );

  const respuestaPeriodoInvalido = await pedir(
    "/api/informes/2019-5/pdf",
    tokenVendedor!,
  );
  verificar(
    "RQNF13.3 un período con formato inválido responde 400",
    respuestaPeriodoInvalido.status === 400,
    `estado=${respuestaPeriodoInvalido.status} mensaje=${await mensajeDe(respuestaPeriodoInvalido)}`,
  );

  const respuestaAdminEnVendedor = await pedir("/api/informes", tokenAdmin!);
  verificar(
    "RQF12 el administrador no puede consultar el historial de informes del vendedor",
    respuestaAdminEnVendedor.status === 403,
    `estado=${respuestaAdminEnVendedor.status} mensaje=${await mensajeDe(respuestaAdminEnVendedor)}`,
  );

  // -------------------------------------------------------------------------
  // RQF14 / RQNF13.2: generación manual y consulta de los informes globales.
  // -------------------------------------------------------------------------
  const respuestaGenerarB = await fetch(
    `${BASE}/api/admin/informes/generar`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenAdmin}`,
      },
      body: JSON.stringify({ periodo: PERIODO_B }),
    },
  );
  const generadoB = (await respuestaGenerarB.json()) as {
    message: string;
    vendedores: number;
    ventasConsideradas: number;
    filasConsideradas: number;
    global: { categoriaMasVendida: string | null; empate: boolean };
  };
  verificar(
    "RQNF13.2 el administrador genera los informes de un período manualmente",
    respuestaGenerarB.status === 200 &&
      generadoB.message.includes(PERIODO_B) &&
      generadoB.vendedores >= 1 &&
      generadoB.ventasConsideradas >= 2,
    `estado=${respuestaGenerarB.status} respuesta=${JSON.stringify(generadoB).slice(0, 300)}`,
  );
  verificar(
    "RQNF14.2 el desempate de la categoría más vendida usa las ventas del mes anterior",
    generadoB.global.empate === false &&
      generadoB.global.categoriaMasVendida === "Ropa",
    `global=${JSON.stringify(generadoB.global)}`,
  );

  const respuestaGenerarC = await fetch(
    `${BASE}/api/admin/informes/generar`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenAdmin}`,
      },
      body: JSON.stringify({ periodo: PERIODO_C }),
    },
  );
  const generadoC = (await respuestaGenerarC.json()) as {
    global: { categoriaMasVendida: string | null; empate: boolean };
  };
  verificar(
    "RQNF14.2 si el empate persiste tras el desempate no se declara categoría más vendida",
    respuestaGenerarC.status === 200 &&
      generadoC.global.empate === true &&
      generadoC.global.categoriaMasVendida === null,
    `global=${JSON.stringify(generadoC.global)}`,
  );

  const respuestaGenerarInvalida = await fetch(
    `${BASE}/api/admin/informes/generar`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenAdmin}`,
      },
      body: JSON.stringify({ periodo: "2019-13" }),
    },
  );
  verificar(
    "RQNF13.2 generar un período con formato inválido responde 400",
    respuestaGenerarInvalida.status === 400,
    `estado=${respuestaGenerarInvalida.status} mensaje=${await mensajeDe(respuestaGenerarInvalida)}`,
  );

  const respuestaGlobales = await pedir("/api/admin/informes", tokenAdmin!);
  const globales = (await respuestaGlobales.json()) as { informes: any[] };
  const globalB = globales.informes.find(
    (informe) => informe.periodo === PERIODO_B,
  );
  const globalC = globales.informes.find(
    (informe) => informe.periodo === PERIODO_C,
  );
  const globalAEnLista = globales.informes.find(
    (informe) => informe.periodo === PERIODO_A,
  );
  verificar(
    "RQF14 el administrador consulta los informes globales de todos los períodos",
    respuestaGlobales.status === 200 &&
      globalAEnLista?.categoriaMasVendida?.categoria === "Hogar" &&
      globalB?.categoriaMasVendida?.categoria === "Ropa" &&
      globalC?.empate === true &&
      globalC?.categoriaMasVendida === null,
    `estado=${respuestaGlobales.status} A=${JSON.stringify(globalAEnLista?.categoriaMasVendida)} B=${JSON.stringify(globalB?.categoriaMasVendida)} C=${JSON.stringify(globalC?.empate)}`,
  );

  const respuestaPdfGlobal = await pedir(
    `/api/admin/informes/${PERIODO_A}/pdf`,
    tokenAdmin!,
  );
  verificar(
    "RQF14 el informe global se descarga en PDF",
    respuestaPdfGlobal.status === 200 &&
      (respuestaPdfGlobal.headers.get("content-type") ?? "").includes(
        "application/pdf",
      ) &&
      (await esPdf(respuestaPdfGlobal)),
    `estado=${respuestaPdfGlobal.status} tipo=${respuestaPdfGlobal.headers.get("content-type")}`,
  );

  const respuestaPdfGlobalInexistente = await pedir(
    "/api/admin/informes/2018-01/pdf",
    tokenAdmin!,
  );
  verificar(
    "RQF14 descargar un informe global inexistente responde 404",
    respuestaPdfGlobalInexistente.status === 404,
    `estado=${respuestaPdfGlobalInexistente.status}`,
  );

  const respuestaVendedorEnAdmin = await pedir(
    "/api/admin/informes",
    tokenVendedor!,
  );
  verificar(
    "el vendedor no puede acceder a los informes globales del administrador",
    respuestaVendedorEnAdmin.status === 403,
    `estado=${respuestaVendedorEnAdmin.status} mensaje=${await mensajeDe(respuestaVendedorEnAdmin)}`,
  );
} finally {
  // -------------------------------------------------------------------------
  // Limpieza: filas, ventas y reportes de PostgreSQL; informes, productos y
  // espejos de MongoDB; cuentas de prueba; backend e conexiones.
  // -------------------------------------------------------------------------
  try {
    for (const productoId of productosCreados) {
      await clientePrisma.cola.deleteMany({ where: { productoId } });
    }
    for (const ventaId of ventasCreadas) {
      await clientePrisma.venta.deleteMany({ where: { id: ventaId } });
    }
    for (const reporteId of reportesCreados) {
      await clientePrisma.reporte.deleteMany({ where: { id: reporteId } });
    }
    for (const idCuenta of idsCuentas) {
      await clientePrisma.usuario.deleteMany({ where: { id: idCuenta } });
    }
  } catch (error) {
    console.error("[limpieza] No se pudieron borrar filas/ventas/reportes:", error);
  }

  try {
    if (productosCreados.length > 0) {
      await Producto.deleteMany({ _id: { $in: productosCreados } });
    }
    for (const idCuenta of idsCuentas) {
      await InformeVendedor.deleteMany({ vendedorId: String(idCuenta) });
    }
    await InformeGlobal.deleteMany({
      periodo: { $in: periodosDeLimpieza },
    });
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
  `\nSuite de informes mensuales: ${resultados.length - fallas.length}/${resultados.length} pruebas pasaron`,
);
if (fallas.length > 0) {
  console.log("Fallas:");
  for (const falla of fallas) console.log(` - ${falla.nombre}: ${falla.detalle}`);
  process.exit(1);
}
process.exit(0);
