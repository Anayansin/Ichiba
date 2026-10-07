/**
 * Crea o promueve una cuenta de administrador de ICHIBA.
 *
 * No existe ninguna ruta pública para crear administradores (por seguridad),
 * así que este script es la única forma de obtener el primer acceso al panel
 * `/admin`.
 *
 * Uso (desde la carpeta `backend`):
 *   npm run admin -- correo@ejemplo.com              # crea la cuenta
 *   npm run admin -- correo@ejemplo.com MiClave123!  # crea con esa contraseña
 *   npm run admin -- correo@ejemplo.com --promover   # promueve una cuenta ya existente
 *
 * Si la cuenta ya existe solo se cambia el tipo a `admin` (y se actualiza el
 * espejo de MongoDB, que es el que leen GraphQL y algunos trabajos).
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import clientePrisma from "../src/configuracion/prisma.js";
import { Usuario } from "../src/models/usuario.js";

const DIAS = [
  "lunes",
  "martes",
  "miercoles",
  "jueves",
  "viernes",
  "sabado",
  "domingo",
] as const;

const HORARIOS = DIAS.map((dia) => ({
  dia,
  activo: true,
  horaInicio: "09:00",
  horaFin: "18:00",
}));

function argumentos() {
  const [, , correo, tercero] = process.argv;
  if (!correo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
    console.error(
      "Uso: npm run admin -- correo@ejemplo.com [contraseña] [--promover]",
    );
    process.exit(1);
  }

  const promover = tercero === "--promover";
  const password = !tercero || promover ? null : tercero;
  return { correo: correo.toLowerCase(), password, promover };
}

async function reflejarEnMongo(datos: {
  id: number;
  nombreCompleto: string;
  direccion: string;
  telefono: string;
  correo: string;
  rfc: string;
  password: string;
  ineFrente: string;
  ineReverso: string;
  aceptaTerminos: boolean;
  recibirNotificacionesCriticas: boolean;
  paypalEmail: string;
  correoVerificado: boolean;
}) {
  await Usuario.updateOne(
    { correo: datos.correo },
    {
      $set: {
        usuarioId: datos.id,
        nombreCompleto: datos.nombreCompleto,
        direccion: datos.direccion,
        telefono: datos.telefono,
        rfc: datos.rfc,
        password: datos.password,
        tipo: "admin",
        ineFrente: datos.ineFrente,
        ineReverso: datos.ineReverso,
        aceptaTerminos: datos.aceptaTerminos,
        recibirNotificacionesCriticas: datos.recibirNotificacionesCriticas,
        metodoPago: "paypal",
        datosMetodoPago: datos.paypalEmail,
        horarios: HORARIOS,
        correoVerificado: datos.correoVerificado,
        diasSinConfirmarHorario: 0,
      },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true },
  );
}

async function main() {
  const { correo, password, promover } = argumentos();

  // El espejo de MongoDB se actualiza en la misma tanda: conectamos antes de
  // tocar nada para no dejar la cuenta sin sincronizar.
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("La variable MONGO_URI no está definida en backend/.env");
    process.exit(1);
  }
  await mongoose.connect(uri);

  const existente = await clientePrisma.usuario.findUnique({
    where: { correo },
  });

  if (existente) {
    await clientePrisma.usuario.update({
      where: { id: existente.id },
      data: { tipo: "admin" },
    });
    await reflejarEnMongo({ ...existente, id: existente.id });
    console.log(`Listo: ${correo} ahora es administrador (id ${existente.id}).`);
    console.log(
      "Si tenías la sesión abierta, cierra sesión y vuelve a entrar para ver el panel /admin.",
    );
    return;
  }

  if (promover) {
    console.error(
      `No existe ninguna cuenta con el correo ${correo}. Quítale --promover para crearla.`,
    );
    process.exit(1);
  }

  const passwordElegida = password ?? "IchibaAdmin123!";
  const passwordHasheada = await bcrypt.hash(passwordElegida, 10);

  const creado = await clientePrisma.usuario.create({
    data: {
      nombreCompleto: "Administrador Ichiba",
      direccion: "Av. Principal 123, Centro, Ciudad de México",
      telefono: "5500000000",
      correo,
      rfc: "XXXX000101MCO",
      password: passwordHasheada,
      tipo: "admin",
      ineFrente: "/uploads/ine/admin-frente.jpg",
      ineReverso: "/uploads/ine/admin-reverso.jpg",
      aceptaTerminos: true,
      recibirNotificacionesCriticas: true,
      recibirNotificacionesPublicitarias: false,
      correoVerificado: true,
      paypalEmail: "admin@example.com",
      horarios: HORARIOS,
      horarioConfirmadoEn: new Date(),
      diasSinConfirmarHorario: 0,
    },
  });

  await reflejarEnMongo({ ...creado, id: creado.id });

  console.log("Cuenta de administrador creada:");
  console.log(`  correo:     ${correo}`);
  console.log(`  contraseña: ${passwordElegida}`);
  console.log(`  id:         ${creado.id}`);
  console.log("Entra en /inicio con esos datos y abre /admin desde el menú.");
}

main()
  .catch((error) => {
    console.error("No se pudo crear el administrador:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    const uri = process.env.MONGO_URI;
    if (uri) await mongoose.disconnect().catch(() => undefined);
    const cerrar = (clientePrisma as { close?: () => Promise<void> }).close;
    if (typeof cerrar === "function") await cerrar().catch(() => undefined);
  });
