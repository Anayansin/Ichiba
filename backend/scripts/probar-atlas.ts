// Prueba de conexión a MongoDB Atlas y listado de lo que hay.
// Uso: npx tsx scripts/probar-atlas.ts
import "dotenv/config";
import mongoose from "mongoose";

const ATLAS = process.env.MONGO_URI_ATLAS ?? "";

async function main() {
  if (!ATLAS) {
    console.error("❌ Falta MONGO_URI_ATLAS en backend/.env");
    process.exit(1);
  }

  console.log("Conectando a Atlas...");
  await mongoose.connect(ATLAS, { serverSelectionTimeoutMS: 15000 });
  console.log("✅ Conectado a Atlas");

  const db = mongoose.connection.db!;
  console.log("Base:", db.databaseName);
  const colecciones = (await db.collections()).map((c) => c.collectionName).sort();
  console.log("Colecciones:", colecciones.join(", ") || "(ninguna)");

  for (const nombre of colecciones) {
    const total = await db.collection(nombre).countDocuments();
    console.log(`  - ${nombre}: ${total} documentos`);
  }

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error("❌ Falló:", error?.message ?? error);
  process.exit(1);
});
