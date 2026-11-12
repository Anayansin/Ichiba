import mongoose from "mongoose";
import "dotenv/config";

/**
 * Depura de MongoDB las colecciones que quedaron sin uso tras mover las
 * cuentas, las filas y los reportes a PostgreSQL:
 *   - usuarios: era el espejo de las cuentas (ahora viven en PostgreSQL);
 *   - colas: las filas viven en PostgreSQL;
 *   - reportes: los reportes viven en PostgreSQL.
 */
await mongoose.connect(process.env.MONGO_URI as string);
const db = mongoose.connection.db!;

for (const coleccion of ["usuarios", "colas", "reportes"]) {
  const total = await db.collection(coleccion).countDocuments();
  await db.collection(coleccion).drop();
  console.log(`eliminada la colección ${coleccion} (${total} documento(s))`);
}

console.log(
  "colecciones restantes:",
  (await db.collections()).map((c) => c.collectionName).sort().join(", "),
);

await mongoose.disconnect();
