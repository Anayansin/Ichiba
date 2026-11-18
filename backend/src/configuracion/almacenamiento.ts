import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

/**
 * En Vercel las funciones solo pueden escribir en /tmp y ese contenido es
 * efímero. En local seguimos usando `backend/uploads` para que las imágenes
 * sobrevivan entre reinicios. El resto del código solo necesita las carpetas
 * exportadas aquí, así no hay rutas duplicadas por todo el backend.
 */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const enVercel =
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

// Fotos de catálogo que viajan con el despliegue. Son de solo lectura y nos
// permiten conservar las imágenes históricas aunque el hosting no tenga disco.
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

/** Ruta pública de una imagen guardada en la carpeta de subidas. */
export function rutaPublicaUploads(...partes: string[]): string {
  return path.posix.join("/uploads", ...partes);
}
