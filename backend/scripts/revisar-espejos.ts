/**
 * Revisión del espejo de MongoDB (RQNF6): lista las cuentas y avisa cuáles
 * no tienen hash bcryptjs válido para poder iniciar sesión. La MONGO_URI
 * inyectada (p. ej. con `railway run`) tiene prioridad sobre el `.env`.
 */
import "dotenv/config";
import mongoose from "mongoose";
import { Usuario } from "../src/models/usuario.js";

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("Falta MONGO_URI");
  console.log("Mongo consultado:", new URL(uri).hostname);

  await mongoose.connect(uri);
  const lista = await Usuario.find({}).lean();

  for (const usuario of lista) {
    const prefijo =
      typeof usuario.password === "string" ? usuario.password.slice(0, 4) : null;
    const ok = prefijo === "$2b$" || prefijo === "$2a$";
    console.log(
      `${ok ? "OK  " : "REPARAR"} ${usuario.correo} (${usuario.tipo}, id=${usuario.usuarioId}, password=${prefijo ?? "ausente"})`,
    );
  }
  console.log("total de cuentas en el espejo:", lista.length);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => undefined);
  });
