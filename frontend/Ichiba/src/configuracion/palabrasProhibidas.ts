/**
 * RQNF10/RQNF10.1 — Alerta inmediata de palabras no permitidas.
 *
 * Espejo del filtro del backend (`backend/src/configuracion/palabrasProhibidas.ts`
 * y `backend/src/utils/filtroPalabras.ts`): mientras el vendedor escribe en
 * los campos de texto de sus publicaciones, el formulario avisa de inmediato
 * si el contenido coincide con una palabra no permitida, usando exactamente
 * la misma normalización que el servidor para que el veredicto de la alerta
 * en vivo siempre coincida con el del envío.
 *
 * ⚠️ El backend sigue siendo la autoridad: al enviar, el servidor vuelve a
 * validar todo el contenido (RQNF10.2/RQNF7.7). Si aquí se agrega o quita
 * una palabra, hay que hacerlo también en el backend.
 */
export const PALABRAS_PROHIBIDAS: string[] = [
  // Insultos directos
  "puto",
  "puta",
  "putos",
  "putas",
  "pendejo",
  "pendeja",
  "pendejos",
  "pendejas",
  "cabron",
  "cabrona",
  "cabrones",
  "cabronas",
  "mierda",
  "mierdas",
  "idiota",
  "idiotas",
  "estupido",
  "estupida",
  "estupidos",
  "estupidas",
  "imbecil",
  "imbeciles",
  "tarado",
  "tarada",
  "tarados",
  "taradas",
  "culero",
  "culera",
  "culeros",
  "culeras",
  "maricon",
  "maricona",
  "maricones",
  "mariconas",
  "zorra",
  "zorras",
  "joto",
  "jotito",
  "jochis",
  "malparido",
  "malparida",
  "malnacido",
  "malnacida",
  "gonorrea",
  "gonorreas",
  "hijodeputa",
  "hijoputa",
  "putamadre",
  "gilipollas",
  "capullo",
  "capullos",
  "subnormal",
  "subnormales",
  "mongolo",
  "mongola",
  "basura",
  "basuras",
  "escoria",
  "maldito",
  "maldita",
  "malditos",
  "malditas",
  "mamon",
  "mamona",
  "mamones",
  "baboso",
  "babosa",
  "babosos",
  "babosas",
  "menso",
  "mensa",
  "mensos",
  "mensas",
  "huevon",
  "huevona",
  "huevones",
  "huevonas",
  "naco",
  "naca",
  "nacos",
  "nacas",
  "inutil",
  "inepto",
  "ineptos",
  "desgraciado",
  "desgraciada",
  "estupidez",
  "estupideces",
  "pendejada",
  "pendejadas",
  "mamarracho",
  "mamarracha",
  // Vulgaridades y lenguaje sexual
  "verga",
  "vergas",
  "culo",
  "culos",
  "culona",
  "culonas",
  "riata",
  "riatas",
  "riatos",
  "riatonas",
  "pene",
  "penes",
  "vagina",
  "vaginas",
  "pechos",
  "senos",
  "coño",
  "cojones",
  "polla",
  "pollas",
  "follar",
  "mamada",
  "mamadas",
  "mamaste",
  // Groserías y expresiones fuertes
  "chingar",
  "chingada",
  "chingadas",
  "chingas",
  "chingon",
  "chingona",
  "chingones",
  "chingonas",
  "jodido",
  "jodida",
  "joder",
  "pinche",
  "pinches",
  "violacion",
  "violaciones",
  "violencia",
  "machismo",
  "wtf",
  "nmms",
  "vtalv",
  "alv",
  "ptm",
  "ctm",
  // Abreviaturas y formas evadidas
  "pto",
  "ptas",
  "pndjo",
  "pndja",
  "pndjos",
  "pndjas",
  "cabrn",
  "cabrna",
  "cabrnes",
  "cabrnas",
  "vrg",
  "vrgs",
  "chng",
  "chngs",
  "mrd",
  "mrds",
  "idta",
  "idtas",
  "estpd",
  "estpds",
  "imbcl",
  "imbcls",
  "trdo",
  "culr",
  // Inglés (común en redes sociales)
  "fuck",
  "fucker",
  "fuckers",
  "fucking",
  "bitch",
  "bitches",
  "asshole",
  "shit",
  "shitty",
  "whore",
  "dick",
  "idiot",
  "idiots",
  "penejo",
];

const REEMPLAZOS_DE_ACENTOS: Array<[RegExp, string]> = [
  [/[áàäâã]/g, "a"],
  [/[éèëê]/g, "e"],
  [/[íìïî]/g, "i"],
  [/[óòöôõ]/g, "o"],
  [/[úùüû]/g, "u"],
];

function quitarAcentos(texto: string): string {
  return REEMPLAZOS_DE_ACENTOS.reduce(
    (resultado, [patron, reemplazo]) => resultado.replace(patron, reemplazo),
    texto,
  );
}

function colapsarRepetidas(texto: string): string {
  return texto.replace(/(.)\1+/g, "$1");
}

function normalizarParaFiltro(texto: string): string {
  return colapsarRepetidas(
    quitarAcentos(texto.toLowerCase()).replace(/[^a-z0-9ñ]+/g, " "),
  ).trim();
}

function planoParaFiltro(texto: string): string {
  return colapsarRepetidas(quitarAcentos(texto.toLowerCase()));
}

type Entrada = {
  palabra: string;
  /** Detecta la palabra escrita con separadores entre letras: "p.u.t.o". */
  obfuscada: RegExp;
};

const ENTRADAS: Entrada[] = Array.from(
  new Set(
    PALABRAS_PROHIBIDAS.map((palabra) =>
      normalizarParaFiltro(palabra).replace(/ /g, ""),
    ).filter(Boolean),
  ),
).map((palabra) => ({
  palabra,
  obfuscada: new RegExp(
    `(^|[^a-z0-9ñ])${palabra.split("").join("[^a-z0-9ñ]+")}([^a-z0-9ñ]|$)`,
  ),
}));

/**
 * Misma detección que el backend: mayúsculas, acentos, plurales, letras
 * repetidas y evasiones con puntos o espacios entre letras.
 */
export function contienePalabrasProhibidas(texto: string): boolean {
  if (!texto) return false;

  const normal = normalizarParaFiltro(texto);
  if (!normal) return false;

  const plano = planoParaFiltro(texto);
  const tokens = normal.split(" ");
  const unido = normal.replace(/ /g, "");

  for (const { palabra, obfuscada } of ENTRADAS) {
    const margen = palabra.length >= 6 ? 2 : 1;
    const coincideToken = tokens.some(
      (token) =>
        token.startsWith(palabra) && token.length - palabra.length <= margen,
    );
    if (coincideToken) return true;

    if (palabra.length >= 6 && unido.includes(palabra)) return true;

    if (obfuscada.test(plano)) return true;
  }

  return false;
}

/** Mismo texto que devuelve el backend, para que la alerta sea idéntica. */
export function mensajePalabrasNoPermitidas(campo: string): string {
  return `El campo "${campo}" contiene palabras no permitidas. Revisa tu texto antes de continuar.`;
}
