export type TipoFalta = "leve" | "grave";

export type CategoriaReporte = {
  id: string;
  nombre: string;
  tipoFalta: TipoFalta;
};

export type ElementoReporte = "publicacion" | "vendedor" | "mensaje" | "cliente";

export const ELEMENTOS_REPORTE: { id: ElementoReporte; nombre: string }[] = [
  { id: "publicacion", nombre: "Una publicación" },
  { id: "vendedor", nombre: "Un vendedor" },
  { id: "mensaje", nombre: "Un mensaje" },
  { id: "cliente", nombre: "Un cliente" },
];

export function nombreElementoReporte(id: string): string {
  return ELEMENTOS_REPORTE.find((elemento) => elemento.id === id)?.nombre ?? id;
}

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

export function textoFalta(tipoFalta: TipoFalta): string {
  return tipoFalta === "grave" ? "falta grave" : "falta leve";
}
