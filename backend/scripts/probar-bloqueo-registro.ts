/**
 * Pruebas del bloqueo del alta de cuenta (RQNF1.9).
 *
 * Comprueba que una cuenta nueva se deniega cuando:
 *   1. sus datos de identificación están en la lista negra;
 *   2. esos datos (o su teléfono) ya pertenecen a otra cuenta;
 *   3. su correo ya tiene una cuenta registrada;
 * y que la persona puede pedir a los administradores que revisen su caso.
 * También comprueba que el login explique el motivo cuando la cuenta está en
 * la lista negra o suspendida.
 *
 * Necesita MongoDB y PostgreSQL (los mismos que usa el backend). Se ejecuta
 * con:
 *
 *   node --harmony-temporal --import tsx scripts/probar-bloqueo-registro.ts
 */
import "dotenv/config";
import assert from "node:assert/strict";
import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { coneccionDB } from "../src/configuracion/db.js";
import { ListaNegra } from "../src/models/ListaNegra.js";
import { SolicitudRegistroBloqueado } from "../src/models/SolicitudRegistroBloqueado.js";
import clientePrisma from "../src/configuracion/prisma.js";
import { iniciarSesion } from "../src/controllers/usuarioController.js";
import {
  CODIGO_DATOS_NO_REGISTRABLES,
  crearSolicitudDeRevision,
  listarSolicitudesDeRevision,
  mensajeDeBloqueoRegistro,
  resolverSolicitudDeRevision,
  revisarBloqueoDeRegistro,
} from "../src/services/bloqueoRegistroService.js";

const RFC_PRUEBA = "TEST010101ABC";
const CURP_PRUEBA = "TEST010101HDFXXX00";
const INE_PRUEBA = "IDETEST0101012345";
const CORREO_PRUEBA = "revision.bloqueo@ichiba.mx";
const TELEFONO_PRUEBA = "5500000001";

let cuentaCreada = false;
let entradaNegra: mongoose.Types.ObjectId | null = null;
let solicitudId: string | null = null;

async function crearCuentaDePrueba() {
  const correo = `bloqueo.${Date.now()}@ichiba.mx`;
  await clientePrisma.usuario.create({
    data: {
      nombreCompleto: "Cuenta de prueba",
      direccion: "Dirección de prueba",
      telefono: TELEFONO_PRUEBA,
      correo,
      rfc: RFC_PRUEBA,
      password: await bcrypt.hash("ClavePrueba123!", 10),
      curp: CURP_PRUEBA,
      ineFrente: "/uploads/ine/prueba-frente.png",
      ineReverso: "/uploads/ine/prueba-reverso.png",
      ineCodigoReverso: INE_PRUEBA,
      paypalEmail: correo,
      horarios: [],
      aceptaTerminos: true,
      recibirNotificacionesCriticas: true,
      recibirNotificacionesPublicitarias: false,
    },
  });
  cuentaCreada = true;
  return correo;
}

/** Ejecuta el controlador real de login sin levantar el servidor HTTP. */
async function intentarLogin(correo: string, password: string) {
  let estado = 200;
  let cuerpo: Record<string, unknown> = {};

  const respuesta = {
    status(codigo: number) {
      estado = codigo;
      return this;
    },
    json(payload: Record<string, unknown>) {
      cuerpo = payload;
      return this;
    },
  } as unknown as Response;

  await iniciarSesion({ body: { correo, password } } as Request, respuesta);
  return { estado, cuerpo };
}

async function main() {
  await coneccionDB();

  console.log("1) Datos limpios: el alta debe permittedse");
  const limpio = await revisarBloqueoDeRegistro({
    rfc: "NUEVO010101XYZ",
    curp: "NUEVO010101HDFXXX00",
    ineCodigoReverso: "IDENUEVO0101012345",
    correo: "nuevo.alta@ichiba.mx",
    telefono: "5500000002",
  });
  assert.equal(limpio.bloqueado, false, "con datos limpios no debe bloquearse");
  assert.equal(limpio.motivo, null);

  console.log("2) Correo de una cuenta existente: se bloquea");
  const correoExistente = await crearCuentaDePrueba();

  const porCorreo = await revisarBloqueoDeRegistro({
    correo: correoExistente,
  });
  assert.equal(porCorreo.bloqueado, true, "el correo repetido debe bloquearse");
  assert.equal(porCorreo.motivo, "correo-en-uso");
  assert.ok(porCorreo.campos.includes("correo"));

  console.log("3) RFC, CURP, INE y teléfono ya usados: se bloquea");
  const porDatos = await revisarBloqueoDeRegistro({
    rfc: RFC_PRUEBA,
    curp: CURP_PRUEBA,
    ineCodigoReverso: INE_PRUEBA,
    telefono: TELEFONO_PRUEBA,
  });
  assert.equal(porDatos.bloqueado, true, "los datos en uso deben bloquearse");
  assert.equal(porDatos.motivo, "datos-en-uso");
  assert.ok(porDatos.campos.includes("rfc"));
  assert.ok(porDatos.campos.includes("curp"));
  assert.ok(porDatos.campos.includes("ineCodigoReverso"));
  assert.ok(porDatos.campos.includes("telefono"));

  console.log("4) Entrada en la lista negra: se bloquea");
  const creada = await ListaNegra.create({
    rfc: RFC_PRUEBA,
    curp: CURP_PRUEBA,
    correo: "lista.negra@ichiba.mx",
    nombreCompleto: "Persona de la lista negra",
    motivo: "Prueba automática del bloqueo de registro",
    origen: "manual",
  });
  entradaNegra = creada._id;

  const porListaNegra = await revisarBloqueoDeRegistro({
    rfc: RFC_PRUEBA,
    correo: "lista.negra@ichiba.mx",
  });
  assert.equal(porListaNegra.bloqueado, true, "la lista negra debe bloquear");
  assert.equal(porListaNegra.motivo, "lista-negra");
  assert.ok(porListaNegra.campos.includes("rfc"));

  console.log("4b) El login rechaza con el motivo de la lista negra");
  const loginListaNegra = await intentarLogin(
    "lista.negra@ichiba.mx",
    "cualquier-password",
  );
  assert.equal(loginListaNegra.estado, 403, "el login debe responder 403");
  assert.equal(loginListaNegra.cuerpo.codigo, "CUENTA_EN_LISTA_NEGRA");
  assert.ok(
    String(loginListaNegra.cuerpo.message).includes("lista negra") &&
      String(loginListaNegra.cuerpo.message).includes(
        "Prueba automática del bloqueo de registro",
      ),
    `el login debe explicar el motivo: ${String(loginListaNegra.cuerpo.message)}`,
  );

  console.log("4c) El login explica los casos genéricos de bloqueo");
  const loginDesconocido = await intentarLogin(
    "no-existe-login@ichiba.mx",
    "cualquier-password",
  );
  assert.equal(loginDesconocido.estado, 401);
  assert.ok(
    String(loginDesconocido.cuerpo.message).includes("cuenta fue cancelada") &&
      String(loginDesconocido.cuerpo.message).includes("lista negra"),
    "el login debe explicar también los casos de cuenta cancelada y lista negra",
  );

  console.log("4d) Una cuenta suspendida explica el motivo del bloqueo");
  const usuarioPrueba = await clientePrisma.usuario.findFirst({
    where: { correo: correoExistente },
  });
  assert.ok(usuarioPrueba, "la cuenta de prueba debe existir");
  await clientePrisma.usuario.update({
    where: { id: usuarioPrueba!.id },
    data: {
      suspendido: true,
      motivoSuspension: "investigación de fraude",
    },
  });

  const loginSuspendido = await intentarLogin(
    correoExistente,
    "ClavePrueba123!",
  );
  assert.equal(loginSuspendido.estado, 403);
  assert.equal(loginSuspendido.cuerpo.codigo, "CUENTA_SUSPENDIDA");
  assert.ok(
    String(loginSuspendido.cuerpo.message).includes("investigación de fraude"),
    `el login debe explicar la suspensión: ${String(loginSuspendido.cuerpo.message)}`,
  );

  console.log("5) El mensaje explica el bloqueo y el contacto con administradores");
  const mensaje = mensajeDeBloqueoRegistro(porListaNegra.motivo!);
  assert.ok(
    mensaje.includes("no pueden ser registrados"),
    `el mensaje debe decir que los datos no pueden registrarse: ${mensaje}`,
  );
  assert.ok(
    mensaje.includes("administradores"),
    "el mensaje debe indicar que puede comunicarse con los administradores",
  );
  const mensajeDatosEnUso = mensajeDeBloqueoRegistro("datos-en-uso");
  assert.ok(
    mensajeDatosEnUso.includes("otra cuenta") &&
      mensajeDatosEnUso.includes("no pueden ser registrados"),
    `el mensaje de datos en uso debe explicar el motivo: ${mensajeDatosEnUso}`,
  );
  assert.equal(CODIGO_DATOS_NO_REGISTRABLES, "DATOS_NO_REGISTRABLES");

  console.log("6) La persona puede pedir revisión a los administradores");
  const solicitud = await crearSolicitudDeRevision({
    nombreCompleto: "Persona de la lista negra",
    correo: CORREO_PRUEBA,
    telefono: TELEFONO_PRUEBA,
    rfc: RFC_PRUEBA,
    motivoBloqueo: "lista-negra",
    camposCoincidentes: ["rfc"],
    mensaje: "Creo que es un error, ya tenía una cuenta.",
  });
  solicitudId = solicitud.id;
  assert.equal(solicitud.estado, "pendiente");

  const listado = await listarSolicitudesDeRevision({ pagina: 1 });
  assert.ok(
    listado.solicitudes.some((item) => item.id === solicitud.id),
    "la solicitud debe aparecer en el listado del BackOffice",
  );

  const atendida = await resolverSolicitudDeRevision(solicitud.id, {
    estado: "resuelta",
    respuesta: "Se autorizó el alta.",
    revisadaPor: "1",
  });
  assert.ok(atendida, "la solicitud debe resolverse");
  assert.equal(atendida!.estado, "resuelta");
  assert.equal(atendida!.respuesta, "Se autorizó el alta.");

  console.log("\nTodas las pruebas pasaron.");
}

async function limpiar() {
  if (entradaNegra) {
    await ListaNegra.deleteOne({ _id: entradaNegra });
  }
  if (solicitudId) {
    await SolicitudRegistroBloqueado.deleteOne({ _id: solicitudId });
  }
  if (cuentaCreada) {
    await clientePrisma.usuario.deleteMany({
      where: { telefono: TELEFONO_PRUEBA },
    });
  }
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
    await clientePrisma.usuario.deleteMany({
      where: { telefono: TELEFONO_PRUEBA },
    });
    process.exit(process.exitCode ?? 0);
  });
