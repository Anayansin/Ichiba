/**
 * Prueba rápida del envío de correos de ICHIBA.
 *
 * Uso (desde la carpeta `backend`):
 *   npm run correo-test                                  # envía a tu Gmail
 *   npm run correo-test -- otro@correo.com               # envía a otra cuenta
 *
 * Si responde "MODO LOCAL" es que backend/.env no tiene GMAIL_USER ni
 * GMAIL_APP_PASSWORD: en ese caso los códigos solo se imprimen en la consola
 * del backend con el prefijo "[correo local]".
 */
import "dotenv/config";
import { enviarCorreoVerificacion } from "../src/services/emailService.js";

const destino = process.argv[2] ?? "yaretzicramos@gmail.com";

async function main() {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.log("MODO LOCAL: faltan GMAIL_USER o GMAIL_APP_PASSWORD en .env");
    process.exitCode = 1;
    return;
  }

  console.log(`Enviando correo de prueba a ${destino}...`);
  await enviarCorreoVerificacion(destino, "1234");
  console.log(`ENVIADO. Revisa la bandeja de entrada de ${destino} (y spam).`);
}

main().catch((error) => {
  console.error("ERROR AL ENVIAR:", error?.message ?? error);
  process.exitCode = 1;
});
