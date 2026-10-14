/**
 * Prueba E2E local de RQNF6.3 a RQNF6.6 sobre `revisarHorariosDeVendedores`.
 *
 * 1) RQNF6.3 — un vendedor con 1 falta recibe el aviso 15 días antes del
 *    1ro de mes (revisión simulada al 17 de oct) y NO se elimina.
 * 2) RQNF6.4/6.5/6.6 — el 1ro de mes, con la 2ª falta, recibe el aviso de
 *    eliminación y se borra TODO: PostgreSQL (usuario, ventas, reportes,
 *    filas), MongoDB (cuenta, productos, promocionales, comentarios, ventas,
 *    mensajes, reportes, sanciones, suscripciones, vínculo PayPal) y los
 *    archivos de disco (INE, productos y promocionales).
 */
import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import { coneccionDB } from "../src/configuracion/db.js";
import clientePrisma from "../src/configuracion/prisma.js";
import { Usuario } from "../src/models/usuario.js";
import { Producto } from "../src/models/producto.js";
import { Promocional } from "../src/models/Promocional.js";
import { Comentario } from "../src/models/Comentario.js";
import { Venta } from "../src/models/Venta.js";
import { Mensaje } from "../src/models/Mensaje.js";
import { Reporte } from "../src/models/Reporte.js";
import { Sancion } from "../src/models/Sancion.js";
import { Suscripcion } from "../src/models/Suscripcion.js";
import { SuscripcionCategoria } from "../src/models/SuscripcionCategoria.js";
import {
  EstadoVinculacionPayPal,
  VinculoPayPal,
} from "../src/models/VinculoPayPal.js";
import { revisarHorariosDeVendedores } from "../src/jobs/revisionHorarios.js";
import { ELEMENTOS_REPORTABLES } from "../src/configuracion/categoriasReporte.js";

const fallos: string[] = [];

function comprobar(condicion: boolean, texto: string) {
  console.log(`  ${condicion ? "OK   " : "FALLO"} — ${texto}`);
  if (!condicion) fallos.push(texto);
}

async function ejecutarYcapturar(fechaBase: Date): Promise<string[]> {
  const salidas: string[] = [];
  const logOriginal = console.log;
  console.log = (...args: unknown[]) => {
    salidas.push(args.map(String).join(" "));
  };
  try {
    await revisarHorariosDeVendedores(fechaBase);
  } finally {
    console.log = logOriginal;
  }
  return salidas;
}

function crearArchivo(rutaRelativa: string): string {
  const ruta = path.join(process.cwd(), rutaRelativa);
  fs.mkdirSync(path.dirname(ruta), { recursive: true });
  fs.writeFileSync(ruta, "contenido de prueba");
  return "/" + rutaRelativa.replace(/\\/g, "/");
}

async function main() {
  // Forzar el modo "correo local": las advertencias salen por consola.
  process.env.GMAIL_USER = "";
  process.env.GMAIL_APP_PASSWORD = "";

  await coneccionDB();
  const marca = Date.now();

  // ---------------------------------------------------------------
  // Protección: no tocar vendedores reales con antigüedad >= 28 días.
  // ---------------------------------------------------------------
  const existentes = await Usuario.find({ tipo: "vendedor" }).lean();
  const antiguos = existentes.filter((u) => {
    const fecha = u.horarioConfirmadoEn ?? u.createdAt;
    return (Date.now() - new Date(fecha).getTime()) / 86_400_000 >= 28;
  });
  if (antiguos.length > 0) {
    console.log(
      "ABORTADO: hay vendedores con 28+ días sin confirmar que la revisión " +
        "eliminaría:",
      antiguos.map((u) => u.correo),
    );
    process.exitCode = 1;
    return;
  }

  // =========================================================================
  // Parte A — RQNF6.3: aviso 15 días antes, sin eliminación.
  // =========================================================================
  console.log("\nParte A: aviso de 15 días (RQNF6.3)");
  const correoA = `aviso15-${marca}@test.local`;
  const confirmacionVieja = new Date("2026-09-01T12:00:00Z");

  const cuentaA = await clientePrisma.usuario.create({
    data: {
      nombreCompleto: "Vendedor Aviso 15",
      direccion: "Direccion A",
      telefono: "5511111111",
      correo: correoA,
      rfc: "TESTA000101MXX",
      password: "x",
      ineFrente: "/uploads/ine/a.jpg",
      ineReverso: "/uploads/ine/a.jpg",
      aceptaTerminos: true,
      recibirNotificacionesCriticas: true,
      paypalEmail: correoA,
      horarios: [],
      horarioConfirmadoEn: confirmacionVieja,
      diasSinConfirmarHorario: 1,
    },
  });
  await Usuario.create({
    usuarioId: cuentaA.id,
    nombreCompleto: "Vendedor Aviso 15",
    direccion: "Direccion A",
    telefono: "5511111111",
    correo: correoA,
    rfc: "TESTA000101MXX",
    password: "x",
    ineFrente: "/uploads/ine/a.jpg",
    ineReverso: "/uploads/ine/a.jpg",
    aceptaTerminos: true,
    recibirNotificacionesCriticas: true,
    metodoPago: "paypal",
    datosMetodoPago: correoA,
    horarioConfirmadoEn: confirmacionVieja,
    diasSinConfirmarHorario: 1,
  });

  // 17 de octubre, 08:00 GMT-6: quedan exactamente 15 días para el 1ro.
  const avisosA = await ejecutarYcapturar(new Date("2026-10-17T14:00:00Z"));

  comprobar(
    avisosA.some((l) => l.includes(correoA) && l.includes("15 días")),
    "RQNF6.3: envía el aviso 15 días antes de la eliminación",
  );
  comprobar(
    !avisosA.some((l) => l.includes(correoA) && l.includes("2 faltas seguidas")),
    "RQNF6.3: aún no envía el aviso de eliminación con 1 falta",
  );

  const cuentaAMongo = await Usuario.findOne({ correo: correoA }).lean();
  comprobar(
    cuentaAMongo !== null && cuentaAMongo.diasSinConfirmarHorario === 1,
    "RQNF6.3: la cuenta sigue intacta con su falta (no se incrementa)",
  );
  const cuentaAPg = await clientePrisma.usuario.findUnique({
    where: { id: cuentaA.id },
  });
  comprobar(
    cuentaAPg !== null && cuentaAPg.diasSinConfirmarHorario === 1,
    "RQNF6.3: PostgreSQL también conserva la falta sin cambios",
  );

  // Limpieza de la cuenta A (aquí se borra manualmente; no es el caso de uso).
  await Usuario.deleteOne({ correo: correoA });
  await clientePrisma.usuario.deleteMany({ where: { id: cuentaA.id } });

  // =========================================================================
  // Parte B — RQNF6.4/6.5/6.6: 2ª falta el 1ro de mes => aviso + borrado total.
  // =========================================================================
  console.log("\nParte B: eliminación total con 2 faltas (RQNF6.4–6.6)");
  const correoB = `eliminacion-${marca}@test.local`;
  const idComprador = `comprador-${marca}`;

  const rutaIneFrente = crearArchivo(`uploads/ine/test-b-${marca}-frente.jpg`);
  const rutaIneReverso = crearArchivo(`uploads/ine/test-b-${marca}-reverso.jpg`);
  const rutaProducto = crearArchivo(
    `uploads/productos/test-b-${marca}.jpg`,
  );
  const rutaPromocional = crearArchivo(
    `uploads/promocionales/test-b-${marca}.jpg`,
  );

  // MongoDB: publicaciones y ecosistema del vendedor B.
  const productoB = await Producto.create({
    nombre: "Producto de prueba eliminacion",
    precio: 1000,
    imagenes: [rutaProducto],
    categoria: "hogar",
    descripcion: "descripcion de prueba",
    vendedor: "Vendedor Eliminacion",
    vendedorId: "se-rellena",
    condicionUso: "nuevo",
    horarioEntregaInicio: "09:00",
    horarioEntregaFin: "18:00",
  });
  const promocionalB = await Promocional.create({
    nombre: "Promo de prueba eliminacion",
    categoria: "muebles-y-arte",
    descripcion: "descripcion de prueba",
    condicionUso: "nuevo",
    imagenes: [rutaPromocional],
    precio: 6000,
    coberturaEnvio: "nacional",
    vendedorId: "se-rellena",
    vendedor: "Vendedor Eliminacion",
  });
  const ventaMongoB = await Venta.create({
    productoId: productoB._id,
    vendedorId: "se-rellena",
    compradorId: idComprador,
    monto: 1000,
    paypalOrderId: `test-b-${marca}`,
  });
  await Mensaje.create({
    ventaId: ventaMongoB._id,
    remitente: "comprador",
    remitenteId: idComprador,
    contenido: "hola",
  });
  await Comentario.create({
    promocionalId: String(promocionalB._id),
    texto: "comentario de prueba",
    autorNombre: "Visitante",
    compradorId: idComprador,
  });
  await Reporte.create({
    tipoReportado: "vendedor",
    sujetoTipo: "usuario",
    sujetoId: "se-rellena",
    reportadoPorTipo: "comprador",
    reportadoPorId: idComprador,
    ventaId: ventaMongoB._id,
    productoId: productoB._id,
    elemento: ELEMENTOS_REPORTABLES[0],
    categoria: "estafa",
    categoriaNombre: "Estafa",
    tipoFalta: "grave",
  });
  await Suscripcion.create({
    compradorId: idComprador,
    correo: correoB,
    categorias: ["hogar"],
    aceptaTerminos: true,
  });
  await SuscripcionCategoria.create({ correo: correoB, categoria: "hogar" });

  // PostgreSQL: la cuenta B con 1 falta desde el 1 de septiembre.
  const cuentaB = await clientePrisma.usuario.create({
    data: {
      nombreCompleto: "Vendedor Eliminacion",
      direccion: "Direccion B",
      telefono: "5522222222",
      correo: correoB,
      rfc: "TESTB000101MXX",
      password: "x",
      ineFrente: rutaIneFrente,
      ineReverso: rutaIneReverso,
      aceptaTerminos: true,
      recibirNotificacionesCriticas: true,
      paypalEmail: correoB,
      horarios: [],
      horarioConfirmadoEn: confirmacionVieja,
      diasSinConfirmarHorario: 1,
    },
  });
  const idB = cuentaB.id;

  // Completa los ids diferidos del espejo Mongo.
  await Producto.updateOne({ _id: productoB._id }, { vendedorId: String(idB) });
  await Promocional.updateOne(
    { _id: promocionalB._id },
    { vendedorId: String(idB) },
  );
  await Venta.updateOne({ _id: ventaMongoB._id }, { vendedorId: String(idB) });
  await Reporte.updateOne(
    { categoria: "estafa", productoId: productoB._id },
    { sujetoId: String(idB) },
  );
  await Usuario.create({
    usuarioId: idB,
    nombreCompleto: "Vendedor Eliminacion",
    direccion: "Direccion B",
    telefono: "5522222222",
    correo: correoB,
    rfc: "TESTB000101MXX",
    password: "x",
    ineFrente: rutaIneFrente,
    ineReverso: rutaIneReverso,
    aceptaTerminos: true,
    recibirNotificacionesCriticas: true,
    metodoPago: "paypal",
    datosMetodoPago: correoB,
    horarioConfirmadoEn: confirmacionVieja,
    diasSinConfirmarHorario: 1,
  });
  await Sancion.create({
    sujetoTipo: "usuario",
    sujetoId: String(idB),
    faltasLeves: 1,
  });
  await VinculoPayPal.create({
    usuarioId: idB,
    correoPayPal: "pay@paypal.test",
    merchantId: `MKT-${idB}`,
    tokenCifrado: "cifrado-de-prueba",
  });
  await EstadoVinculacionPayPal.create({
    state: `state-${marca}`,
    usuarioId: idB,
    expira: new Date(Date.now() + 600_000),
  });

  // PostgreSQL: venta, reporte y fila sobre las publicaciones de B.
  const ventaPgB = await clientePrisma.venta.create({
    data: {
      productoId: String(productoB._id),
      vendedorId: idB,
      compradorId: idComprador,
      monto: 1000,
      paypalOrderId: `pg-test-b-${marca}`,
    },
  });
  await clientePrisma.reporte.create({
    data: {
      tipoReportado: "vendedor",
      sujetoTipo: "usuario",
      sujetoId: String(idB),
      reportadoPorTipo: "comprador",
      reportadoPorId: idComprador,
      ventaId: String(ventaMongoB._id),
      productoId: String(productoB._id),
      elemento: ELEMENTOS_REPORTABLES[0],
      categoria: "estafa",
      categoriaNombre: "Estafa",
      tipoFalta: "grave",
      vendedorId: idB,
    },
  });
  await clientePrisma.cola.create({
    data: {
      productoId: String(productoB._id),
      compradorId: idComprador,
      correo: `${idComprador}@test.local`,
      posicion: 1,
      estado: "activa",
    },
  });

  // 1ro de octubre, 08:00 GMT-6: toca la 2ª falta => aviso + borrado.
  const avisosB = await ejecutarYcapturar(new Date("2026-10-01T14:00:00Z"));

  comprobar(
    avisosB.some((l) => l.includes(correoB) && l.includes("2 faltas seguidas")),
    "RQNF6.4: envía el aviso de eliminación al llegar a 2 faltas",
  );

  // PostgreSQL.
  comprobar(
    (await clientePrisma.usuario.findUnique({ where: { id: idB } })) === null,
    "RQNF6.6: borra la cuenta de PostgreSQL (ya no puede iniciar sesión)",
  );
  comprobar(
    (await clientePrisma.venta.findMany({ where: { vendedorId: idB } }))
      .length === 0,
    "RQNF6.6: borra sus ventas de PostgreSQL",
  );
  comprobar(
    (await clientePrisma.reporte.findMany({ where: { vendedorId: idB } }))
      .length === 0,
    "RQNF6.6: borra sus reportes de PostgreSQL",
  );
  comprobar(
    (await clientePrisma.cola.findMany({
      where: { productoId: String(productoB._id) },
    })).length === 0,
    "RQNF6.6: borra las filas de espera de sus publicaciones",
  );

  // MongoDB.
  comprobar(
    (await Usuario.countDocuments({ correo: correoB })) === 0,
    "RQNF6.6: borra la copia de la cuenta en MongoDB",
  );
  comprobar(
    (await Producto.countDocuments({ _id: productoB._id })) === 0 &&
      (await Promocional.countDocuments({ _id: promocionalB._id })) === 0,
    "RQNF6.6: borra sus productos y promocionales",
  );
  comprobar(
    (await Comentario.countDocuments({
      promocionalId: String(promocionalB._id),
    })) === 0,
    "RQNF6.6: borra los comentarios de sus promocionales",
  );
  comprobar(
    (await Venta.countDocuments({ vendedorId: String(idB) })) === 0 &&
      (await Mensaje.countDocuments({ ventaId: ventaMongoB._id })) === 0,
    "RQNF6.6: borra sus ventas y mensajes",
  );
  comprobar(
    (await Reporte.countDocuments({ sujetoId: String(idB) })) === 0 &&
      (await Reporte.countDocuments({ reportadoPorId: String(idB) })) === 0,
    "RQNF6.6: borra sus reportes (recibidos y enviados)",
  );
  comprobar(
    (await Sancion.countDocuments({ sujetoId: String(idB) })) === 0,
    "RQNF6.6: borra sus sanciones",
  );
  comprobar(
    (await Suscripcion.countDocuments({ correo: correoB })) === 0 &&
      (await SuscripcionCategoria.countDocuments({ correo: correoB })) === 0,
    "RQNF6.6: borra sus suscripciones de notificaciones",
  );
  comprobar(
    (await VinculoPayPal.countDocuments({ usuarioId: idB })) === 0 &&
      (await EstadoVinculacionPayPal.countDocuments({ usuarioId: idB })) === 0,
    "RQNF6.6: borra el vínculo de PayPal (Merchant ID y tokens cifrados)",
  );

  // Archivos.
  comprobar(
    !fs.existsSync(path.join(process.cwd(), rutaProducto.replace(/^\//, ""))) &&
      !fs.existsSync(
        path.join(process.cwd(), rutaPromocional.replace(/^\//, "")),
      ) &&
      !fs.existsSync(path.join(process.cwd(), rutaIneFrente.replace(/^\//, ""))) &&
      !fs.existsSync(path.join(process.cwd(), rutaIneReverso.replace(/^\//, ""))),
    "RQNF6.6: borra los archivos de disco (productos, promocionales e INE)",
  );

  console.log(
    fallos.length === 0
      ? "\nRESULTADO: todas las comprobaciones pasaron."
      : `\nRESULTADO: ${fallos.length} comprobación(es) fallaron:\n- ${fallos.join("\n- ")}`,
  );
  if (fallos.length > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error("falló:", error?.stack ?? error);
    process.exitCode = 1;
  })
  .finally(async () => {
    const cerrar = (clientePrisma as { close?: () => Promise<void> }).close;
    if (typeof cerrar === "function") await cerrar().catch(() => undefined);
    await mongoose.disconnect().catch(() => undefined);
  });
