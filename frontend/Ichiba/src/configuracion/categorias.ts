export const CATEGORIAS_PRODUCTO = [
  "Artesanias",
  "Ropa",
  "Hogar",
  "Electrodomesticos",
  "Coleccionables",
  "Otros",
];

export const CATEGORIAS_PRODUCTO_CON_TEXTO: { valor: string; texto: string }[] =
  [
    { valor: "Artesanias", texto: "Artesanías" },
    { valor: "Ropa", texto: "Ropa (segunda mano)" },
    { valor: "Hogar", texto: "Hogar" },
    { valor: "Electrodomesticos", texto: "Electrodomésticos" },
    { valor: "Coleccionables", texto: "Coleccionables" },
    { valor: "Otros", texto: "Otros" },
  ];

export function textoCategoria(valor?: string): string {
  return (
    CATEGORIAS_PRODUCTO_CON_TEXTO.find((cat) => cat.valor === valor)?.texto ??
    valor ??
    ""
  );
}

export const TIPOS_PROMOCIONAL = [
  { valor: "autos-y-vehiculos", texto: "Autos y vehículos" },
  { valor: "casas-y-propiedades", texto: "Casas y propiedades" },
  { valor: "terrenos-y-lotes", texto: "Terrenos y lotes" },
  { valor: "joyas-y-relojes", texto: "Joyas y relojes" },
  { valor: "muebles-y-arte", texto: "Muebles y arte" },
  { valor: "servicios", texto: "Servicios" },
  { valor: "otros", texto: "Otros" },
];

export function textoPromocional(valor?: string): string {
  return (
    TIPOS_PROMOCIONAL.find((tipo) => tipo.valor === valor)?.texto || "Otros"
  );
}
