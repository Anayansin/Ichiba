import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const enVercel =
  process.env.VERCEL === "1" ||
  Boolean(process.env.VERCEL_ENV) ||
  Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);

const raizSubidas = enVercel
  ? path.join(os.tmpdir(), "ichiba")
  : path.join(__dirname, "../../");

export const carpetaUploads = path.join(raizSubidas, "uploads");
export const carpetaIne = path.join(carpetaUploads, "ine");
export const carpetaComprobantes = path.join(carpetaUploads, "comprobantes");
export const carpetaDisputas = path.join(carpetaUploads, "disputas");

export const carpetaUploadsPublicos = path.join(
  __dirname,
  "../../public/uploads",
);

for (const carpeta of [
  carpetaUploads,
  carpetaIne,
  carpetaComprobantes,
  carpetaDisputas,
]) {
  if (!fs.existsSync(carpeta)) {
    fs.mkdirSync(carpeta, { recursive: true });
  }
}

export function rutaPublicaUploads(...partes: string[]): string {
  return path.posix.join("/uploads", ...partes);
}
