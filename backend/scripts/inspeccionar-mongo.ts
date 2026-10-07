// Uso: npx tsx scripts/inspeccionar-mongo.ts [coleccion]
import mongoose from "mongoose";

const coleccion = process.argv[2] ?? "usuarios";

async function main() {
  const uri = process.env.MONGO_URI ?? "mongodb://127.0.0.1:27017/ichiba";
  await mongoose.connect(uri);
  const db = mongoose.connection.db!;
  const nombres = (await db.collections()).map((c) => c.collectionName).sort();
  console.log("Colecciones:", nombres.join(", "));
  const docs = await db.collection(coleccion).find({}).limit(5).toArray();
  console.log(`\n--- ${coleccion} (${docs.length} mostrados) ---`);
  console.log(JSON.stringify(docs, null, 2));
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
