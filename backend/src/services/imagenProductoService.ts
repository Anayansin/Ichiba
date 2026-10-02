import sharp from "sharp";

export async function validarDimensionesProducto(
  rutaArchivo: string,
): Promise<boolean> {
  try {
    const metadata = await sharp(rutaArchivo).metadata();
    const ancho = metadata.width || 0;
    const alto = metadata.height || 0;
    return ancho >= 420 && alto >= 540 && ancho <= 2560 && alto <= 2560;
  } catch {
    return false;
  }
}
