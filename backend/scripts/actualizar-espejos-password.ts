/**
 * RQNF6 — Repara el espejo de MongoDB de una cuenta: escribe el hash
 * bcryptjs de la contraseña indicada en la colección `usuario`, que es la
 * que consulta la autenticación.
 *
 * Uso (desde la carpeta `backend`):
 *   node --harmony-temporal --import tsx scripts/actualizar-espejos-password.ts <correo> <password>
 *
 * Una MONGO_URI ya inyectada (p. ej. con `railway run`) tiene prioridad
 * sobre la del `.env` local; el hostname consultado se imprime siempre.
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { Usuario } from "../src/models/usuario.js";

async function main() {
  const [correo, password] = process.argv.slice(2);
  if (!correo || !password) {
    console.error(
      "Uso: node --harmony-temporal --import tsx scripts/actualizar-espejos-password.ts <correo> <password>",
    );
    process.exitCode = 1;
    return;
  }

  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error("Falta la variable MONGO_URI");
  }

  await mongoose.connect(uri);
  console.log(`Mongo consultado: ${new URL(uri).hostname}`);

  const passwordHasheada = await bcrypt.hash(password, 10);
  const resultado = await Usuario.updateOne(
    { correo },
    { $set: { password: passwordHasheada } },
  );

  console.log(
    resultado.matchedCount === 0
      ? `No existe el espejo de ${correo}; no se modificó nada.`
      : `Espejo de ${correo} actualizado con el hash bcryptjs.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => undefined);
  });
