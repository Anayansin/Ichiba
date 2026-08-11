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

export function validarFormatoImagen(archivo: File): boolean {
  const tiposPermitidos = ["image/png", "image/jpeg", "image/jpg"];
  return tiposPermitidos.includes(archivo.type);
}
