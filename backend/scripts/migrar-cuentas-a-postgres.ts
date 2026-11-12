import mongoose from "mongoose";
import "dotenv/config";
import clientePrisma from "../src/configuracion/prisma.js";

/**
 * Migración de una sola vez (RQNF1.9 / RQNF33 / RQNF37): pasa a PostgreSQL los
 * campos de cuenta que hasta ahora solo vivían en el espejo de MongoDB, para
 * que las dos bases queden iguales antes de apagar el espejo.
 *
 *   node --harmony-temporal --import tsx scripts/migrar-cuentas-a-postgres.ts
 */
await mongoose.connect(process.env.MONGO_URI as string);
const coleccion = mongoose.connection.db!.collection("usuarios");

const espejos = await coleccion.find({}).toArray();
let migradas = 0;

for (const espejo of espejos) {
  const id = Number(espejo.usuarioId);
  if (!Number.isInteger(id)) continue;

  await clientePrisma.usuario.update({
    where: { id },
    data: {
      metodoPago: String(espejo.metodoPago ?? "paypal"),
      suspendido: Boolean(espejo.suspendido),
      motivoSuspension: espejo.motivoSuspension ?? null,
      saldoPendiente: Number(espejo.saldoPendiente ?? 0),
      sancionHasta: espejo.sancionHasta ?? null,
      sancionPermanente: Boolean(espejo.sancionPermanente),
      revisionAdministrativa: Boolean(espejo.revisionAdministrativa),
    },
  });

  console.log(`migrada la cuenta ${espejo.correo} (id ${id})`);
  migradas += 1;
}

console.log(`\nCuentas migradas: ${migradas}`);

await mongoose.disconnect();
