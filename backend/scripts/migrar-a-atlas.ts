// Copia TODO de la base local de MongoDB a MongoDB Atlas (una sola vez).
// Es idempotente: si un documento ya existe en Atlas, se omite sin romper nada.
// Uso: npx tsx scripts/migrar-a-atlas.ts
import "dotenv/config";
import mongoose from "mongoose";

/**
 * Atlas en este proyecto se usa con la base `Ichiba` (con mayúscula): el
 * nombre `ichiba` quedó reservado en el catálogo del clúster y el usuario no
 * tiene permiso de `dropDatabase` para liberarlo. Localmente se usa `ichiba`.
 * La conexión vive en `MONGO_URI_ATLAS` (backend/.env, nunca en git).
 */
const ATLAS = process.env.MONGO_URI_ATLAS ?? "";
const LOCAL = process.env.MONGO_URI ?? "mongodb://127.0.0.1:27017/ichiba";

async function main() {
  if (!ATLAS) {
    console.error("❌ Falta MONGO_URI_ATLAS en backend/.env");
    process.exit(1);
  }

  console.log("Conectando al Mongo local...");
  const origen = await mongoose.createConnection(LOCAL, {
    serverSelectionTimeoutMS: 10000,
  }).asPromise();

  console.log("Conectando a Atlas...");
  const destino = await mongoose.createConnection(ATLAS, {
    serverSelectionTimeoutMS: 20000,
  }).asPromise();

  const dbOrigen = origen.db!;
  const dbDestino = destino.db!;
  const colecciones = (await dbOrigen.collections())
    .map((c) => c.collectionName)
    .sort();

  console.log(`\nColecciones locales: ${colecciones.join(", ") || "(ninguna)"}\n`);

  let totalCopiados = 0;

  for (const nombre of colecciones) {
    const documentos = await dbOrigen.collection(nombre).find({}).toArray();

    if (documentos.length > 0) {
      try {
        const res = await dbDestino
          .collection(nombre)
          .insertMany(documentos, { ordered: false });
        totalCopiados += res.insertedCount;
      } catch (error: unknown) {
        // 11000 = duplicado: el documento ya estaba en Atlas, no es un fallo.
        const mensaje = String((error as Error).message ?? "");
        const codigo = (error as { code?: number }).code;
        const esDuplicado =
          codigo === 11000 || mensaje.includes("E11000 duplicate key");
        if (!esDuplicado) {
          console.error(`  ❌ ${nombre}: ${mensaje}`);
          throw error;
        }
        totalCopiados += (error as { result?: { insertedCount?: number } })
          .result?.insertedCount;
        console.log(`  (algunos documentos de ${nombre} ya existían)`);
      }
    }

    // Índices (texto, únicos, TTL...): se recrean tal cual en Atlas.
    const indices = await dbOrigen.collection(nombre).indexes();
    for (const indice of indices) {
      if (indice.name === "_id_") continue;
      const { ns: _ns, ...resto } = indice as unknown as Record<string, unknown>;
      try {
        await dbDestino.collection(nombre).createIndex(
          resto.key as Record<string, 1 | -1 | "text" | "2dsphere">,
          resto,
        );
      } catch (error) {
        console.log(
          `  (índice ${indice.name} de ${nombre} no se pudo crear: ${(error as Error).message})`,
        );
      }
    }

    const enAtlas = await dbDestino.collection(nombre).countDocuments();
    console.log(`  ${nombre}: ${documentos.length} copiados → ${enAtlas} en Atlas`);
  }

  console.log(`\n✅ Total copiado: ${totalCopiados} documentos`);

  await origen.close();
  await destino.close();
}

main().catch((error) => {
  console.error("❌ Falló la migración:", error?.message ?? error);
  process.exit(1);
});
