/**
 * Categorías y elementos de reporte (espejo de
 * backend/src/configuracion/categoriasReporte.ts).
 * El backend es quien valida y decide el tipo de falta.
 */
export type TipoFalta = "leve" | "grave";

export type CategoriaReporte = {
  id: string;
  nombre: string;
  tipoFalta: TipoFalta;
};

export const ELEMENTOS_REPORTE = [
  { id: "mensaje", nombre: "Mensaje en el chat" },
  { id: "comentario", nombre: "Comentario" },
  { id: "comprobante", nombre: "Comprobante de pago" },
  { id: "estafa", nombre: "Estafa o dinero no entregado" },
  { id: "producto", nombre: "Producto" },
  { id: "otro", nombre: "Otro" },
];

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

export function textoFalta(tipoFalta: TipoFalta): string {
  return tipoFalta === "grave" ? "falta grave" : "falta leve";
}
