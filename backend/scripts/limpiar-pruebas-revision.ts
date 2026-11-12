/**
 * Limpia los datos que dejan las pruebas del bloqueo de alta y de la
 * solicitud de revisión (RQNF1.9): cuentas de administrador de prueba,
 * solicitudes de revisión y cuentas creadas por los scripts.
 *
 *   node --harmony-temporal --import tsx scripts/limpiar-pruebas-revision.ts
 */
import mongoose from "mongoose";
import "dotenv/config";
import { coneccionDB } from "../src/configuracion/db.js";
import { Usuario } from "../src/models/usuario.js";
import { SolicitudRegistroBloqueado } from "../src/models/SolicitudRegistroBloqueado.js";
import clientePrisma from "../src/configuracion/prisma.js";

const CORREOS_DE_PRUEBA = [
  /^admin\.revision\..*@ichiba\.test$/,
  /^bloqueo\..*@ichiba\.mx$/,
];

await coneccionDB();

// Cuentas de administrador y cuentas de prueba creadas por los scripts.
const cuentas = await clientePrisma.usuario.findMany({
  where: { tipo: "admin" },
});

for (const cuenta of cuentas) {
  if (!CORREOS_DE_PRUEBA.some((patron) => patron.test(cuenta.correo))) continue;
  await clientePrisma.usuario.deleteMany({ where: { id: cuenta.id } });
  await Usuario.deleteOne({ correo: cuenta.correo });
}

const borradas = await SolicitudRegistroBloqueado.deleteMany({
  correo: { $regex: "^persona\\..*@ichiba\\.mx$" },
});

console.log("solicitudes borradas:", borradas.deletedCount);
await mongoose.disconnect();
console.log("limpieza lista");
