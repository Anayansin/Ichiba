/**
 * Consola de datos de Ichiba: revisa y modifica a mano la base de datos
 * relacional (PostgreSQL) y la no relacional (MongoDB) desde el terminal,
 * sin instalar clientes externos (aquí no hay `psql` ni `mongosh`).
 *
 * Uso (desde `backend/`):
 *   npx tsx scripts/consola-datos.ts tablas
 *   npx tsx scripts/consola-datos.ts sql "SELECT * FROM usuario LIMIT 5"
 *   npx tsx scripts/consola-datos.ts sql "UPDATE usuario SET telefono = '5512345678' WHERE id = 3 RETURNING *"
 *   npx tsx scripts/consola-datos.ts colecciones
 *   npx tsx scripts/consola-datos.ts ver usuarios 3
 *   npx tsx scripts/consola-datos.ts editar usuarios '{"correo":"ana@ejemplo.mx"}' '{"nombreCompleto":"Ana"}'
 *   npx tsx scripts/consola-datos.ts borrar usuarios '{"correo":"ana@ejemplo.mx"}' --confirmar
 *
 * En Mongo, un valor `null` dentro de los cambios borra ese campo.
 *
 * OJO: PostgreSQL y MongoDB guardan la misma información en dos formatos.
 * La fuente de verdad del rol, la contraseña, el teléfono y los saldos es
 * PostgreSQL; MongoDB guarda el espejo que leen el login, el panel, GraphQL
 * y los chats. Si editas una cuenta en una base, replica el cambio en la otra
 * (o usa `scripts/crear-admin.ts` y `scripts/revisar-espejos.ts`).
 */
import "dotenv/config";
import fs from "node:fs/promises";
import mongoose from "mongoose";
import pg from "pg";

const [comando, ...resto] = process.argv.slice(2);

function conexion(): string {
  const url = process.env.DATABASE_URL ?? "";
  return url.replace(/:\/\/([^:]+):[^@]+@/, "://$1:****@");
}

function mongoUri(): string {
  const url = process.env.MONGO_URI ?? "";
  return url.replace(/:\/\/([^:]+):[^@]+@/, "://$1:****@");
}

function titulo(texto: string): void {
  console.log(`\n=== ${texto} ===`);
}

async function conPostgres() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  return pool;
}

async function listarTablas(pool: pg.Pool): Promise<void> {
  titulo("Tablas de PostgreSQL");
  const resultado = await pool.query(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' ORDER BY table_name`,
  );
  for (const { table_name } of resultado.rows) {
    const conteo = await pool.query(
      `SELECT COUNT(*)::int AS total FROM "${table_name}"`,
    );
    console.log(
      `  ${table_name.padEnd(22)} ${String(conteo.rows[0].total).padStart(6)} fila(s)`,
    );
  }
}

async function ejecutarSql(pool: pg.Pool, consulta: string): Promise<void> {
  const esEscritura = /^\s*(update|delete|insert|alter|drop|truncate|create)/i.test(
    consulta,
  );
  if (esEscritura && !/where/i.test(consulta)) {
    console.error(
      "⚠️  La consulta no tiene WHERE: puede modificar toda la tabla. Si es intencional, agrégalo.",
    );
  }

  titulo("PostgreSQL");
  const resultado = await pool.query(consulta);
  if (Array.isArray(resultado.rows)) {
    console.log(
      resultado.rows.length > 0
        ? JSON.stringify(resultado.rows, null, 2)
        : "(sin filas)",
    );
    if (resultado.rows.length > 0) {
      console.log(`(${resultado.rows.length} fila(s))`);
    }
  }
  if (resultado.rowCount !== undefined && resultado.rowCount !== null) {
    console.log(`Filas afectadas: ${resultado.rowCount}`);
  }
}

async function conMongo() {
  await mongoose.connect(process.env.MONGO_URI as string);
  return mongoose.connection.db!;
}

async function listarColecciones(db: mongoose.mongo.Db): Promise<void> {
  titulo("Colecciones de MongoDB");
  const colecciones = await db.collections();
  for (const coleccion of colecciones) {
    const total = await coleccion.countDocuments();
    console.log(
      `  ${coleccion.collectionName.padEnd(24)} ${String(total).padStart(6)} documento(s)`,
    );
  }
}

async function verDocumentos(
  db: mongoose.mongo.Db,
  nombre: string,
  limite: number,
): Promise<void> {
  titulo(`MongoDB · ${nombre}`);
  const documentos = await db
    .collection(nombre)
    .find({})
    .limit(limite)
    .toArray();
  if (documentos.length === 0) {
    console.log("(sin documentos)");
    return;
  }
  console.log(JSON.stringify(documentos, null, 2));
}

async function editarDocumentos(
  db: mongoose.mongo.Db,
  nombre: string,
  filtro: Record<string, unknown>,
  cambios: Record<string, unknown>,
): Promise<void> {
  const unset: Record<string, unknown> = {};
  const set: Record<string, unknown> = {};
  for (const [campo, valor] of Object.entries(cambios)) {
    if (valor === null) unset[campo] = "";
    else set[campo] = valor;
  }

  const Actualizar = mongoose.model(
    nombre,
    new mongoose.Schema({}, { strict: false }),
  );
  const consulta = { $set: set, ...(Object.keys(unset).length ? { $unset: unset } : {}) };

  const previos = await db.collection(nombre).find(filtro).limit(5).toArray();
  titulo(`MongoDB · ${nombre}`);
  console.log("Documentos que coinciden:");
  console.log(JSON.stringify(previos, null, 2));
  console.log(`Cambio: ${JSON.stringify(consulta)}`);

  const resultado = await Actualizar.updateMany(filtro, consulta);
  console.log(`Documentos actualizados: ${resultado.modifiedCount}`);
  // Solo se da de baja el modelo temporal de Mongoose (no toca la base).
  mongoose.deleteModel(nombre);
}

async function borrarDocumentos(
  db: mongoose.mongo.Db,
  nombre: string,
  filtro: Record<string, unknown>,
  confirmado: boolean,
): Promise<void> {
  const previos = await db.collection(nombre).find(filtro).limit(5).toArray();
  titulo(`MongoDB · ${nombre}`);
  console.log("Documentos que se borrarán:");
  console.log(JSON.stringify(previos, null, 2));

  if (!confirmado) {
    console.log(
      "\nNo se borró nada. Vuelve a ejecutarlo con --confirmar si es lo que quieres.",
    );
    return;
  }

  const resultado = await db.collection(nombre).deleteMany(filtro);
  console.log(`Documentos borrados: ${resultado.deletedCount}`);
}

function avisoEspejo(coleccion: string): void {
  if (
    [
      "usuarios",
      "products",
      "promocionals",
      "ventas",
      "colas",
      "reportes",
      "listanegras",
    ].includes(coleccion)
  ) {
    console.log(
      "\n⚠️  Esta colección tiene espejo en PostgreSQL: replica el cambio allá\n" +
        "    (o usa scripts/crear-admin.ts y scripts/revisar-espejos.ts).",
    );
  }
}

/** Mongoose guarda las colecciones en plural: "usuario" -> "usuarios". */
const ALIAS: Record<string, string> = {
  usuario: "usuarios",
  producto: "products",
  promocional: "promocionals",
  venta: "ventas",
  cola: "colas",
  reporte: "reportes",
  listanegra: "listanegras",
  solicitudregistrobloqueado: "solicitudregistrobloqueados",
  mensaje: "mensajes",
  comentario: "comentarios",
  disputa: "disputas",
  adeudo: "adeudos",
  sancion: "sancions",
  informe: "informeglobals",
  informeGlobal: "informeglobals",
};

function nombreColeccion(nombre: string): string {
  return ALIAS[nombre] ?? nombre;
}

/**
 * Lee un filtro o un conjunto de cambios. Acepta tres formas para que no
 * haya que pelearse con las comillas de PowerShell:
 *   - un archivo .json:  editar usuario filtro.json cambios.json
 *   - pares clave=valor: editar usuario correo=ana@ejemplo.mx telefono=5512345678
 *   - JSON directo:     editar usuario '{"correo":"ana@ejemplo.mx"}' '{"telefono":"5512345678"}'
 */
async function leerObjeto(argumento: string): Promise<Record<string, unknown>> {
  if (!argumento) return {};

  if (argumento.trim().endsWith(".json")) {
    const contenido = await fs.readFile(argumento.trim(), "utf8");
    return JSON.parse(contenido);
  }

  const trimmed = argumento.trim();
  if (trimmed.startsWith("{")) {
    return JSON.parse(trimmed);
  }

  const objeto: Record<string, unknown> = {};
  for (const parte of trimmed.split(",")) {
    const separador = parte.indexOf("=");
    if (separador < 0) continue;
    const clave = parte.slice(0, separador).trim();
    const valor = parte.slice(separador + 1).trim();
    if (!clave) continue;
    // Solo se convierten booleanos y null: los números se guardan como texto
    // para no cambiar el tipo del campo (un teléfono no debe volverse número).
    if (valor === "true" || valor === "false") objeto[clave] = valor === "true";
    else if (valor === "null") objeto[clave] = null;
    else objeto[clave] = valor;
  }
  return objeto;
}

async function main() {
  if (!comando) {
    console.log(
      "Comandos: tablas · sql <consulta> · colecciones · ver <coleccion> [n] · editar <coleccion> '<filtro>' '<cambios>' · borrar <coleccion> '<filtro>' --confirmar",
    );
    return;
  }

  if (comando === "tablas") {
    const pool = await conPostgres();
    console.log(`PostgreSQL: ${conexion()}`);
    await listarTablas(pool);
    await pool.end();
    return;
  }

  if (comando === "sql") {
    const consulta = resto.join(" ").trim();
    if (!consulta) {
      console.error("Escribe la consulta: sql \"SELECT ...\"");
      process.exitCode = 1;
      return;
    }
    const pool = await conPostgres();
    console.log(`PostgreSQL: ${conexion()}`);
    await ejecutarSql(pool, consulta);
    await pool.end();
    return;
  }

  if (comando === "colecciones") {
    console.log(`MongoDB: ${mongoUri()}`);
    const db = await conMongo();
    await listarColecciones(db);
    await mongoose.disconnect();
    return;
  }

  if (comando === "ver") {
    const [nombre, limite] = resto;
    if (!nombre) {
      console.error("Indica la colección: ver <coleccion> [n]");
      process.exitCode = 1;
      return;
    }
    console.log(`MongoDB: ${mongoUri()}`);
    const db = await conMongo();
    await verDocumentos(db, nombreColeccion(nombre), Number(limite) || 5);
    await mongoose.disconnect();
    return;
  }

  if (comando === "editar") {
    const [nombre, filtroJson, cambiosJson] = resto;
    if (!nombre || !filtroJson || !cambiosJson) {
      console.error(
        'Uso: editar <coleccion> \'{"campo":"valor"}\' \'{"campo":"nuevo"}\'',
      );
      process.exitCode = 1;
      return;
    }
    const db = await conMongo();
    const coleccion = nombreColeccion(nombre);
    await editarDocumentos(
      db,
      coleccion,
      await leerObjeto(filtroJson),
      await leerObjeto(cambiosJson),
    );
    avisoEspejo(coleccion);
    await mongoose.disconnect();
    return;
  }

  if (comando === "borrar") {
    const [nombre, filtroJson] = resto;
    if (!nombre || !filtroJson) {
      console.error('Uso: borrar <coleccion> \'{"campo":"valor"}\' --confirmar');
      process.exitCode = 1;
      return;
    }
    const db = await conMongo();
    await borrarDocumentos(
      db,
      nombreColeccion(nombre),
      await leerObjeto(filtroJson),
      resto.includes("--confirmar"),
    );
    await mongoose.disconnect();
    return;
  }

  console.error(`Comando desconocido: ${comando}`);
  process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error("Error:", error?.message ?? error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
