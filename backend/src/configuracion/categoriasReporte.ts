export type TipoFalta = "leve" | "grave";

export type CategoriaReporte = {
  id: string;
  nombre: string;
  tipoFalta: TipoFalta;
  puntos: number;
  revisionInmediata?: boolean;
};

export const PUNTOS_POR_TIPO_FALTA: Record<TipoFalta, number> = {
  grave: 3,
  leve: 1,
};

export const ELEMENTOS_REPORTABLES = [
  "publicacion",
  "vendedor",
  "mensaje",
  "cliente",
] as const;

export const CATEGORIA_REVISION_MANUAL = "otro";

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
    revisionInmediata: true,
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
    revisionInmediata: true,
  },
  {
    id: "estafa",
    nombre: "Estafa o dinero no entregado",
    tipoFalta: "grave",
    puntos: 3,
    revisionInmediata: true,
  },
  {
    id: "suplantacion",
    nombre: "Suplantación de identidad",
    tipoFalta: "grave",
    puntos: 3,
    revisionInmediata: true,
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

export function categoriaRequiereRevisionInmediata(id: string): boolean {
  return categoriaReporte(id)?.revisionInmediata === true;
}

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
