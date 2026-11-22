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

export const PESO_MAXIMO_BYTES = 8 * 1024 * 1024;

export function validarPesoImagen(archivo: File): boolean {
  return archivo.size <= PESO_MAXIMO_BYTES;
}

export function validarFormatoImagen(archivo: File): boolean {
  const tiposPermitidos = ["image/png", "image/jpeg", "image/jpg"];
  return tiposPermitidos.includes(archivo.type);
}

export function validarDimensionesEnRango(
  archivo: File,
  minimo = { ancho: 420, alto: 540 },
  maximo = { ancho: 2560, alto: 2560 },
): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(archivo);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(
        img.width >= minimo.ancho &&
          img.height >= minimo.alto &&
          img.width <= maximo.ancho &&
          img.height <= maximo.alto,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(false);
    };
    img.src = url;
  });
}
