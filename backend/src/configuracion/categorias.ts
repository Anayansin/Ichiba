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

export function esCategoriaPromocional(valor: unknown): boolean {
  return (
    typeof valor === "string" &&
    (CATEGORIAS_PROMOCIONAL as readonly string[]).includes(valor)
  );
}
