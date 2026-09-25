/** Categorías de productos (se compran dentro de la plataforma). */
export const CATEGORIAS_PRODUCTO = [
  "Artesanias",
  "Ropa",
  "Hogar",
  "Electrodomesticos",
  "Coleccionables",
  "Otros",
];

/**
 * Tipos de promocionales: se anuncian en la plataforma pero la compra se
 * coordina fuera de ICHIBA (autos, casas, terrenos, joyas, etc.).
 */
export const TIPOS_PROMOCIONAL = [
  { valor: "autos-y-vehiculos", texto: "Autos y vehículos" },
  { valor: "casas-y-propiedades", texto: "Casas y propiedades" },
  { valor: "terrenos-y-lotes", texto: "Terrenos y lotes" },
  { valor: "joyas-y-relojes", texto: "Joyas y relojes" },
  { valor: "muebles-y-arte", texto: "Muebles y arte" },
  { valor: "servicios", texto: "Servicios" },
  { valor: "otros", texto: "Otros" },
];

/** Nombre para mostrar de un tipo de promocional (si no existe, "Otros"). */
export function textoPromocional(valor?: string): string {
  return (
    TIPOS_PROMOCIONAL.find((tipo) => tipo.valor === valor)?.texto || "Otros"
  );
}
