import sharp from "sharp";
import { createWorker } from "tesseract.js";
import fs from "fs";

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

export async function extraerTextoINE(rutaArchivo: string): Promise<string> {
  const rutaProcesada = rutaArchivo.replace(/(\.[^.]+)$/, "-procesada$1");

  await sharp(rutaArchivo)
    .greyscale()
    .normalize()
    .sharpen()
    .toFile(rutaProcesada);

  const worker = await createWorker("spa");
  const { data } = await worker.recognize(rutaProcesada);
  await worker.terminate();

  fs.unlinkSync(rutaProcesada);

  return data.text;
}

function normalizar(texto: string): string {
  return texto
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function coincideNombreEnTexto(
  textoOCR: string,
  nombreCompleto: string,
): boolean {
  const textoNormalizado = normalizar(textoOCR);
  const palabrasNombre = normalizar(nombreCompleto)
    .split(" ")
    .filter((palabra) => palabra.length > 2);

  if (palabrasNombre.length === 0) return false;

  const coincidencias = palabrasNombre.filter((palabra) =>
    textoNormalizado.includes(palabra),
  );
  return coincidencias.length / palabrasNombre.length >= 0.7;
}
