// Diagnóstico de Atlas: qué bases existen, cuánto pesan y cuántos documentos
// tiene cada colección. Sirve para comprobar un volcado desde el navegador.
// Uso: npx tsx scripts/diagnosticar-atlas.ts
import "dotenv/config";
import mongoose from "mongoose";

const ATLAS = process.env.MONGO_URI_ATLAS ?? "";

async function main() {
  if (!ATLAS) {
    console.error("❌ Falta MONGO_URI_ATLAS en backend/.env");
    process.exit(1);
  }

  const conexion = await mongoose.createConnection(ATLAS, {
    serverSelectionTimeoutMS: 20000,
  }).asPromise();

  const bases = await conexion.db!.admin().listDatabases({ nameOnly: false });
  console.log("Bases en el clúster:");
  for (const base of bases.databases) {
    console.log(
      `  - ${base.name} (${((base.sizeOnDisk ?? 0) / 1024).toFixed(1)} KB)`,
    );
    if (["admin", "local", "config"].includes(base.name)) continue;
    for (const coleccion of await conexion.client.db(base.name).collections()) {
      const total = await coleccion.countDocuments().catch(() => -1);
      console.log(`      · ${coleccion.collectionName}: ${total}`);
    }
  }

  await conexion.close();
}

main().catch((error) => {
  console.error("❌", error?.message ?? error);
  process.exit(1);
});
