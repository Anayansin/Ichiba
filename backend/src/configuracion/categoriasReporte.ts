export type TipoFalta = "leve" | "grave";

export type CategoriaReporte = {
  id: string;
  nombre: string;
  tipoFalta: TipoFalta;
};

/** Elementos que se pueden reportar (qué es lo que el usuario flagrtea). */
export const ELEMENTOS_REPORTABLES = [
  "mensaje",
  "comentario",
  "comprobante",
  "estafa",
  "producto",
  "otro",
] as const;

/**
 * Categorías predefinidas de reporte, al estilo de las redes sociales.
 * Cada categoría indica si genera una falta leve o una falta grave.
 */
export const CATEGORIAS_REPORTE: CategoriaReporte[] = [
  {
    id: "falta_respeto",
    nombre: "Faltas de respeto o insultos",
    tipoFalta: "leve",
  },
  {
    id: "lenguaje_ofensivo",
    nombre: "Lenguaje grosero o inapropiado",
    tipoFalta: "leve",
  },
  {
    id: "actitud_hostil",
    nombre: "Actitud hostil o arrogante",
    tipoFalta: "leve",
  },
  {
    id: "spam",
    nombre: "Spam o publicidad no deseada",
    tipoFalta: "leve",
  },
  {
    id: "acoso",
    nombre: "Acoso, amenazas o intimidación",
    tipoFalta: "grave",
  },
  {
    id: "discriminacion",
    nombre: "Discriminación o discurso de odio",
    tipoFalta: "grave",
  },
  {
    id: "producto_enganoso",
    nombre: "Producto engañoso o diferente a la descripción",
    tipoFalta: "grave",
  },
  {
    id: "comprobante_falso",
    nombre: "Comprobante de pago falso",
    tipoFalta: "grave",
  },
  {
    id: "estafa",
    nombre: "Estafa o dinero no entregado",
    tipoFalta: "grave",
  },
  {
    id: "datos_falsos",
    nombre: "Datos falsos (INE, correo o PayPal)",
    tipoFalta: "grave",
  },
  {
    id: "suplantacion",
    nombre: "Suplantación de identidad",
    tipoFalta: "grave",
  },
  {
    id: "otro",
    nombre: "Otro motivo",
    tipoFalta: "leve",
  },
];

export function categoriaReporte(id: string): CategoriaReporte | null {
  return CATEGORIAS_REPORTE.find((categoria) => categoria.id === id) ?? null;
}
