/**
 * Prueba local del modal de confirmación mensual de horario (RQNF5.3):
 * retrocede `horarioConfirmadoEn` de una cuenta de vendedor al mes pasado
 * para que el modal bloqueante aparezca al abrir el panel.
 *
 * Uso (desde la carpeta `backend`):
 *   node --harmony-temporal --import tsx scripts/retroceder-confirmacion.ts [correo] [fechaISO]
 *
 * Por defecto: vendedor.demo@ichiba.test, 1 de septiembre de 2026.
 * Al confirmar desde el modal, la fecha vuelve a la actual y queda en normal.
 */
import "dotenv/config";
import mongoose from "mongoose";
import clientePrisma from "../src/configuracion/prisma.js";
import { Usuario } from "../src/models/usuario.js";

async function main() {
  const correo = process.argv[2] ?? "vendedor.demo@ichiba.test";
  const fecha = new Date(
    process.argv[3] ?? "2026-09-01T12:00:00.000Z",
  );

  const cuenta = await clientePrisma.usuario.update({
    where: { correo },
    data: { horarioConfirmadoEn: fecha },
    select: { id: true, correo: true, horarioConfirmadoEn: true },
  });
  console.log("Postgres:", cuenta);

  const uri = process.env.MONGO_URI;
  if (uri) {
    await mongoose.connect(uri);
    await Usuario.updateOne({ correo }, { $set: { horarioConfirmadoEn: fecha } });
    console.log("Mongo espejo actualizado.");
    await mongoose.disconnect();
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    const cerrar = (clientePrisma as { close?: () => Promise<void> }).close;
    if (typeof cerrar === "function") await cerrar().catch(() => undefined);
  });
