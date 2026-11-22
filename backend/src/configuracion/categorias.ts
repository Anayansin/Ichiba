export const CATEGORIAS_PRODUCTO = [
  "Artesanias",
  "Ropa",
  "Hogar",
  "Electrodomesticos",
  "Coleccionables",
  "Otros",
] as const;

export const CATEGORIAS_PROMOCIONAL = [
  "autos-y-vehiculos",
  "casas-y-propiedades",
  "terrenos-y-lotes",
  "joyas-y-relojes",
  "muebles-y-arte",
  "servicios",
  "otros",
] as const;

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
