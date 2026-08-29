import sharp from "sharp";
import { createWorker } from "tesseract.js";
export async function validarDimensionesINE(
  rutaArchivo: string,
): Promise<boolean> {
  const metadata = await sharp(rutaArchivo).metadata();
  const ancho = metadata.width || 0;
  const alto = metadata.height || 0;
  return ancho >= 420 && alto >= 540;
}

export async function validarNitidezINE(rutaArchivo: string): Promise<boolean> {
  const stats = await sharp(rutaArchivo).greyscale().stats();
  const desviacion = stats.channels[0].stdev;
  return desviacion > 15;
}

export async function extraerCodigoReversoINE(
  rutaArchivo: string,
): Promise<string | null> {
  const worker = await createWorker("eng");
  await worker.setParameters({
    tessedit_char_whitelist: "0123456789<",
  });

  const { data } = await worker.recognize(rutaArchivo);
  await worker.terminate();

  const coincidencia = data.text.match(/<<\s*(\d{13})/);
  return coincidencia ? coincidencia[1] : null;
}

export function formatoCodigoValido(codigo: string | null): boolean {
  return codigo !== null && /^\d{13}$/.test(codigo);
}
