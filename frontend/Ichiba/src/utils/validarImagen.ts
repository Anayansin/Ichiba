export function validarDimensionesImagen(archivo: File): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(archivo);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img.width >= 420 && img.height >= 540);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(false);
    };

    img.src = url;
  });
}

/** 8 MB, el mismo límite que aplica el backend en uploadIne.ts */
export const PESO_MAXIMO_BYTES = 8 * 1024 * 1024;

export function validarPesoImagen(archivo: File): boolean {
  return archivo.size <= PESO_MAXIMO_BYTES;
}

export function validarFormatoImagen(archivo: File): boolean {
  const tiposPermitidos = ["image/png", "image/jpeg", "image/jpg"];
  return tiposPermitidos.includes(archivo.type);
}
