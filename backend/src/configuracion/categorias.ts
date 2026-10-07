/**
 * Categorías del catálogo de productos (se compran dentro de la plataforma).
 * Deben coincidir con `CATEGORIAS_PRODUCTO` del frontend
 * (`frontend/Ichiba/src/configuracion/categorias.ts`).
 */
export const CATEGORIAS_PRODUCTO = [
  "Artesanias",
  "Ropa",
  "Hogar",
  "Electrodomesticos",
  "Coleccionables",
  "Otros",
] as const;

/**
 * Tipos de promocionales: artículos o servicios que se anuncian en la
 * plataforma pero que NO se compran en ella (autos, casas, terrenos, etc.).
 * La compra siempre se coordina fuera de ICHIBA.
 */
export const CATEGORIAS_PROMOCIONAL = [
  "autos-y-vehiculos",
  "casas-y-propiedades",
  "terrenos-y-lotes",
  "joyas-y-relojes",
  "muebles-y-arte",
  "servicios",
  "otros",
] as const;

/**
 * Devuelve la categoría canónica del catálogo (con sus mayúsculas de origen)
 * cuando `valor` coincide sin distinguir mayúsculas; `null` en otro caso.
 * El frontend enlaza `/inicio?categoria=artesanias`, por eso se ignora el caso.
 */
export function categoriaProductoValida(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const buscado = valor.trim().toLowerCase();
  return (
    CATEGORIAS_PRODUCTO.find(
      (categoria) => categoria.toLowerCase() === buscado,
    ) ?? null
  );
}

export function esCategoriaPromocional(
  valor: unknown,
): valor is (typeof CATEGORIAS_PROMOCIONAL)[number] {
  return (
    typeof valor === "string" &&
    (CATEGORIAS_PROMOCIONAL as readonly string[]).includes(valor)
  );
}
