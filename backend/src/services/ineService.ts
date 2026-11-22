import sharp from "sharp";

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
