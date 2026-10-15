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
 * RQF8: las seis categorías predefinidas con el texto que ve el vendedor.
 * Los valores internos no cambian (las bases de datos, filtados y enlaces
 * `/inicio?categoria=artesanias` los usan tal cual).
 */
export const CATEGORIAS_PRODUCTO_CON_TEXTO: { valor: string; texto: string }[] =
  [
    { valor: "Artesanias", texto: "Artesanías" },
    { valor: "Ropa", texto: "Ropa (segunda mano)" },
    { valor: "Hogar", texto: "Hogar" },
    { valor: "Electrodomesticos", texto: "Electrodomésticos" },
    { valor: "Coleccionables", texto: "Coleccionables" },
    { valor: "Otros", texto: "Otros" },
  ];

/** Nombre para mostrar de una categoría de producto (si no existe, el valor). */
export function textoCategoria(valor?: string): string {
  return (
    CATEGORIAS_PRODUCTO_CON_TEXTO.find((cat) => cat.valor === valor)?.texto ??
    valor ??
    ""
  );
}

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
