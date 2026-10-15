export type TipoFalta = "leve" | "grave";

export type CategoriaReporte = {
  id: string;
  nombre: string;
  tipoFalta: TipoFalta;
  /**
   * RQNF10.1: puntos de infracción que suma la categoría a la reputación del
   * vendedor cuando un administrador confirma el reporte:
   *   - faltas graves: 3 puntos
   *   - faltas leves de trato directo (faltas de respeto / lenguaje grosero): 1.5 puntos
   *   - resto de faltas leves: 1 punto
   */
  puntos: number;
};

/** Puntos por tipo de falta, para reportes sin categoría conocida. */
export const PUNTOS_POR_TIPO_FALTA: Record<TipoFalta, number> = {
  grave: 3,
  leve: 1,
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
 * Cada categoría indica si genera una falta leve o una falta grave y cuántos
 * puntos de reputación (RQNF10.1) suma al confirmarse el reporte.
 */
export const CATEGORIAS_REPORTE: CategoriaReporte[] = [
  {
    id: "falta_respeto",
    nombre: "Faltas de respeto o insultos",
    tipoFalta: "leve",
    puntos: 1.5,
  },
  {
    id: "lenguaje_ofensivo",
    nombre: "Lenguaje grosero o inapropiado",
    tipoFalta: "leve",
    puntos: 1.5,
  },
  {
    id: "actitud_hostil",
    nombre: "Actitud hostil o arrogante",
    tipoFalta: "leve",
    puntos: 1,
  },
  {
    id: "spam",
    nombre: "Spam o publicidad no deseada",
    tipoFalta: "leve",
    puntos: 1,
  },
  {
    id: "acoso",
    nombre: "Acoso, amenazas o intimidación",
    tipoFalta: "grave",
    puntos: 3,
  },
  {
    id: "discriminacion",
    nombre: "Discriminación o discurso de odio",
    tipoFalta: "grave",
    puntos: 3,
  },
  {
    id: "producto_enganoso",
    nombre: "Producto engañoso o diferente a la descripción",
    tipoFalta: "grave",
    puntos: 3,
  },
  {
    id: "comprobante_falso",
    nombre: "Comprobante de pago falso",
    tipoFalta: "grave",
    puntos: 3,
  },
  {
    id: "estafa",
    nombre: "Estafa o dinero no entregado",
    tipoFalta: "grave",
    puntos: 3,
  },
  {
    id: "datos_falsos",
    nombre: "Datos falsos (INE, correo o PayPal)",
    tipoFalta: "grave",
    puntos: 3,
  },
  {
    id: "suplantacion",
    nombre: "Suplantación de identidad",
    tipoFalta: "grave",
    puntos: 3,
  },
  {
    id: "otro",
    nombre: "Otro motivo",
    tipoFalta: "leve",
    puntos: 1,
  },
];

export function categoriaReporte(id: string): CategoriaReporte | null {
  return CATEGORIAS_REPORTE.find((categoria) => categoria.id === id) ?? null;
}

/**
 * RQNF10.1: puntos que suma un reporte según su categoría. Si la categoría
 * no existe (datos viejos), se usa el tipo de falta registrado en el reporte.
 */
export function puntosDeCategoria(
  categoria: string,
  tipoFalta?: string | null,
): number {
  const info = categoriaReporte(categoria);
  if (info) return info.puntos;

  if (tipoFalta === "grave") return PUNTOS_POR_TIPO_FALTA.grave;
  if (tipoFalta === "leve") return PUNTOS_POR_TIPO_FALTA.leve;
  return 0;
}
