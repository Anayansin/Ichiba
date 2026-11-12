/**
 * Prueba de extremo a extremo de la solicitud de revisión de un alta
 * denegada (RQNF1.9): la persona la envía desde el formulario de registro y
 * el administrador la atiende desde el BackOffice.
 *
 * Requiere el backend levantado (http://localhost:5000) y sus bases de datos.
 * Se ejecuta con:
 *
 *   node --harmony-temporal --import tsx scripts/probar-solicitud-revision.ts
 */
import "dotenv/config";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { coneccionDB } from "../src/configuracion/db.js";
import { Usuario } from "../src/models/usuario.js";
import { SolicitudRegistroBloqueado } from "../src/models/SolicitudRegistroBloqueado.js";
import clientePrisma from "../src/configuracion/prisma.js";

const BASE = process.env.BASE_URL ?? "http://localhost:5000";
const MARCA = Date.now();
const CORREO_ADMIN = `admin.revision.${MARCA}@ichiba.test`;
const PASSWORD_ADMIN = "ClaveDePrueba123!";
const HORARIOS: { dia: string; activo: boolean; horaInicio: string; horaFin: string }[] =
  [
    {
      dia: "lunes",
      activo: true,
      horaInicio: "09:00",
      horaFin: "18:00",
    },
  ];

let idAdmin: number | null = null;

async function crearAdminDePrueba() {
  const passwordHasheada = await bcrypt.hash(PASSWORD_ADMIN, 10);
  const horarioConfirmadoEn = new Date();

  const creado = await clientePrisma.usuario.create({
    data: {
      nombreCompleto: "Administrador de prueba",
      direccion: "Av. de las Pruebas 501, Centro, Ciudad de México",
      telefono: `55${String(MARCA).slice(-8)}`,
      correo: CORREO_ADMIN,
      rfc: `ADM${String(MARCA).slice(-10)}`,
      password: passwordHasheada,
      tipo: "admin",
      correoVerificado: true,
      ineFrente: "/uploads/ine/prueba-frente.jpg",
      ineReverso: "/uploads/ine/prueba-reverso.jpg",
      aceptaTerminos: true,
      recibirNotificacionesCriticas: true,
      recibirNotificacionesPublicitarias: false,
      paypalEmail: CORREO_ADMIN,
      horarios: HORARIOS,
      horarioConfirmadoEn,
      diasSinConfirmarHorario: 0,
      estadoCuenta: "activa",
    },
  });
  idAdmin = creado.id;

  await Usuario.updateOne(
    { correo: CORREO_ADMIN },
    {
      $set: {
        usuarioId: creado.id,
        nombreCompleto: "Administrador de prueba",
        direccion: "Av. de las Pruebas 501, Centro, Ciudad de México",
        telefono: `55${String(MARCA).slice(-8)}`,
        correo: CORREO_ADMIN,
        rfc: `ADM${String(MARCA).slice(-10)}`,
        password: passwordHasheada,
        tipo: "admin",
        correoVerificado: true,
        metodoPago: "paypal",
        datosMetodoPago: CORREO_ADMIN,
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
}

async function iniciarSesion(): Promise<string> {
  const respuesta = await fetch(`${BASE}/api/usuarios/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ correo: CORREO_ADMIN, password: PASSWORD_ADMIN }),
  });
  const datos = (await respuesta.json().catch(() => null)) as {
    token?: string;
  } | null;
  assert.ok(
    respuesta.ok && datos?.token,
    "el administrador de prueba debe poder iniciar sesión",
  );
  return datos!.token!;
}

async function main() {
  await coneccionDB();
  await crearAdminDePrueba();
  const token = await iniciarSesion();
  console.log("1) La persona envía su solicitud de revisión (endpoint público)");

  const correoPersona = `persona.${MARCA}@ichiba.mx`;
  const enviada = await fetch(
    `${BASE}/api/usuarios/registro/solicitar-revision`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombreCompleto: "Persona que pide revisión",
        correo: correoPersona,
        telefono: "5500000099",
        rfc: "REV010101ABC",
        mensaje: "Creo que es un error: ya tenía una cuenta con estos datos.",
        motivo: "lista-negra",
      }),
    },
  );
  const datosEnviada = (await enviada.json().catch(() => null)) as {
    message?: string;
    solicitud?: { id: string; estado: string };
  } | null;

  assert.equal(enviada.status, 201, "la solicitud debe aceptarse");
  assert.ok(
    datosEnviada?.message?.includes("administradores"),
    "la respuesta debe decir que los administradores la revisarán",
  );
  assert.ok(datosEnviada?.solicitud?.id, "la respuesta debe incluir el folio");
  console.log("   ->", datosEnviada?.message);

  console.log("2) La solicitud aparece en el BackOffice");
  const listado = await fetch(`${BASE}/api/admin/solicitudes-registro`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const datosListado = (await listado.json().catch(() => null)) as {
    solicitudes?: { id: string; correo: string; estado: string }[];
    total?: number;
  } | null;

  assert.equal(listado.status, 200, "el listado debe cargarse");
  const solicitud = datosListado?.solicitudes?.find(
    (item) => item.id === datosEnviada!.solicitud!.id,
  );
  assert.ok(solicitud, "la solicitud debe aparecer en el listado");
  assert.equal(solicitud!.estado, "pendiente");
  assert.equal(solicitud!.correo, correoPersona.toLowerCase());
  console.log(`   -> ${datosListado?.total} solicitud(es) en el panel`);

  console.log("3) El administrador la resuelve");
  const resuelta = await fetch(
    `${BASE}/api/admin/solicitudes-registro/${solicitud!.id}/resolver`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        estado: "resuelta",
        respuesta: "Autorizamos el alta, ya verificamos tus datos.",
      }),
    },
  );
  const datosResuelta = (await resuelta.json().catch(() => null)) as {
    solicitud?: { estado: string; respuesta: string };
  } | null;

  assert.equal(resuelta.status, 200, "la solicitud debe resolverse");
  assert.equal(datosResuelta?.solicitud?.estado, "resuelta");
  assert.equal(
    datosResuelta?.solicitud?.respuesta,
    "Autorizamos el alta, ya verificamos tus datos.",
  );
  console.log("   -> solicitud resuelta");

  console.log("4) Un estado inválido se rechaza");
  const invalido = await fetch(
    `${BASE}/api/admin/solicitudes-registro/${solicitud!.id}/resolver`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ estado: "inventado" }),
    },
  );
  assert.equal(invalido.status, 400, "un estado inválido debe rechazarse");

  console.log("\nTodas las pruebas pasaron.");
}

async function limpiar() {
  if (idAdmin !== null) {
    await clientePrisma.usuario.deleteMany({ where: { id: idAdmin } });
    await Usuario.deleteOne({ correo: CORREO_ADMIN });
  }
  // Solo se borra la solicitud que creó esta prueba.
  await SolicitudRegistroBloqueado.deleteMany({
    correo: `persona.${MARCA}@ichiba.mx`,
  });
}

main()
  .catch((error) => {
    console.error("\nFALLÓ UNA PRUEBA:", error?.message ?? error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await limpiar();
    } catch (error) {
      console.error("No se pudo limpiar la prueba:", error?.message ?? error);
    }
    await mongoose.disconnect();
    process.exit(process.exitCode ?? 0);
  });
