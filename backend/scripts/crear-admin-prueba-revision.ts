/**
 * Crea un administrador de prueba (para revisar el BackOffice a mano) y una
 * solicitud de revisión de registro pendiente.
 *
 *   node --harmony-temporal --import tsx scripts/crear-admin-prueba-revision.ts
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { coneccionDB } from "../src/configuracion/db.js";
import { Usuario } from "../src/models/usuario.js";
import { SolicitudRegistroBloqueado } from "../src/models/SolicitudRegistroBloqueado.js";
import clientePrisma from "../src/configuracion/prisma.js";

const MARCA = Date.now();
const CORREO = `admin.revision.${MARCA}@ichiba.test`;
const PASSWORD = "ClaveDePrueba123!";

async function main() {
  await coneccionDB();

  const passwordHasheada = await bcrypt.hash(PASSWORD, 10);
  const horarios = [
    { dia: "lunes", activo: true, horaInicio: "09:00", horaFin: "18:00" },
  ];
  const horarioConfirmadoEn = new Date();

  const creado = await clientePrisma.usuario.create({
    data: {
      nombreCompleto: "Administrador de prueba",
      direccion: "Av. de las Pruebas 501, Centro, Ciudad de México",
      telefono: `55${String(MARCA).slice(-8)}`,
      correo: CORREO,
      rfc: `ADM${String(MARCA).slice(-10)}`,
      password: passwordHasheada,
      tipo: "admin",
      correoVerificado: true,
      ineFrente: "/uploads/ine/prueba-frente.jpg",
      ineReverso: "/uploads/ine/prueba-reverso.jpg",
      aceptaTerminos: true,
      recibirNotificacionesCriticas: true,
      recibirNotificacionesPublicitarias: false,
      paypalEmail: CORREO,
      horarios,
      horarioConfirmadoEn,
      diasSinConfirmarHorario: 0,
      estadoCuenta: "activa",
    },
  });

  await Usuario.updateOne(
    { correo: CORREO },
    {
      $set: {
        usuarioId: creado.id,
        nombreCompleto: "Administrador de prueba",
        direccion: "Av. de las Pruebas 501, Centro, Ciudad de México",
        telefono: `55${String(MARCA).slice(-8)}`,
        correo: CORREO,
        rfc: `ADM${String(MARCA).slice(-10)}`,
        password: passwordHasheada,
        tipo: "admin",
        correoVerificado: true,
        metodoPago: "paypal",
        datosMetodoPago: CORREO,
        horarios,
        horarioConfirmadoEn,
        diasSinConfirmarHorario: 0,
        puntosReputacion: 0,
        estadoCuenta: "activa",
      },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true },
  );

  await SolicitudRegistroBloqueado.create({
    nombreCompleto: "Persona que pide revisión",
    correo: `persona.${MARCA}@ichiba.mx`,
    telefono: "5500000099",
    rfc: "REV010101ABC",
    motivoBloqueo: "lista-negra",
    camposCoincidentes: ["rfc", "curp"],
    mensaje: "Creo que es un error: ya tenía una cuenta con estos datos.",
    estado: "pendiente",
  });

  console.log("Administrador de prueba:", CORREO);
  console.log("Contraseña:", PASSWORD);

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
