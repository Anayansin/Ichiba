// Respalda la base vieja `Ichiba` y elimina lo que sobra en Atlas:
//   1) copia `Ichiba` a `ichiba_respaldo_agosto`
//   2) borra `Ichiba` (así se puede crear `ichiba` sin conflicto de mayúsculas)
//   3) borra `sample_mflix` (145 MB de datos de ejemplo de Netflix)
// Uso: npx tsx scripts/limpiar-atlas.ts
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

  const admin = conexion.db!.admin();
  const antes = await admin.listDatabases({ nameOnly: true });
  console.log(
    "Bases antes:",
    antes.databases.map((d) => d.name).join(", "),
  );

  // 1) Respaldo de la base vieja
  if (antes.databases.some((d) => d.name === "Ichiba")) {
    const origen = conexion.client.db("Ichiba");
    const respaldo = conexion.client.db("ichiba_respaldo_agosto");
    let total = 0;

    for (const coleccion of await origen.collections()) {
      const docs = await coleccion.find({}).toArray();
      if (docs.length > 0) {
        try {
          await respaldo
            .collection(coleccion.collectionName)
            .insertMany(docs, { ordered: false });
          total += docs.length;
        } catch (error) {
          // Ya estaba respaldado en una corrida anterior.
          if (!String((error as Error).message ?? "").includes("E11000")) {
            throw error;
          }
        }
      }
      console.log(`  respaldado ${coleccion.collectionName}: ${docs.length}`);
    }
    console.log(`✅ Respaldo listo en "ichiba_respaldo_agosto" (${total} documentos)`);

    // 2) Se vacía la base vieja (borrar sus colecciones hace que la base
    //    deje de existir, lo que libera el nombre `Ichiba`)
    for (const coleccion of await origen.collections()) {
      await coleccion.drop();
    }
    console.log('✅ Base "Ichiba" vaciada (ya no existe)');
  } else {
    console.log('La base "Ichiba" ya no existe');
  }

  // 3) Vaciado de los datos de ejemplo de Netflix
  if (antes.databases.some((d) => d.name === "sample_mflix")) {
    const ejemplo = conexion.client.db("sample_mflix");
    for (const coleccion of await ejemplo.collections()) {
      await coleccion.drop();
    }
    console.log('✅ Base "sample_mflix" vaciada (ya no existe)');
  }

  const despues = await admin.listDatabases({ nameOnly: true });
  console.log("\nBases después:", despues.databases.map((d) => d.name).join(", "));

  await conexion.close();
}

main().catch((error) => {
  console.error("❌ Falló:", error?.message ?? error);
  process.exit(1);
});
