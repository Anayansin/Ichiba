import { Request, Response, NextFunction } from "express";
import { PALABRAS_PROHIBIDAS } from "../configuracion/palabrasProhibidas.js";

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

/**
 * Versión normalizada para comparar: minúsculas, sin acentos, separadores
 * convertidos en espacios y letras repetidas colapsadas ("putoooo" -> "puto").
 * Conserva la ñ para no confundir "coño" con "cono".
 */
export function normalizarParaFiltro(texto: string): string {
  return colapsarRepetidas(
    quitarAcentos(texto.toLowerCase()).replace(/[^a-z0-9ñ]+/g, " "),
  ).trim();
}

/** Minúsculas, sin acentos y con letras repetidas colapsadas, pero conservando los separadores. */
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
 * Detecta palabras prohibidas en un texto libre.
 * Cubre: mayúsculas, acentos, plurales, letras repetidas y evasiones
 * con puntos/espacios entre letras ("c.o.b.r.o.n").
 */
export function contienePalabrasProhibidas(texto: string): boolean {
  if (!texto) return false;

  const normal = normalizarParaFiltro(texto);
  if (!normal) return false;

  const plano = planoParaFiltro(texto);
  const tokens = normal.split(" ");
  const unido = normal.replace(/ /g, "");

  for (const { palabra, obfuscada } of ENTRADAS) {
    // Plural o variación corta: "pendejo" -> "pendejos".
    const margen = palabra.length >= 6 ? 2 : 1;
    const coincideToken = tokens.some(
      (token) =>
        token.startsWith(palabra) && token.length - palabra.length <= margen,
    );
    if (coincideToken) return true;

    // Palabra embebida en un solo bloque: "hijodeputa", "computaciónmierda".
    if (palabra.length >= 6 && unido.includes(palabra)) return true;

    // Palabra intercalada con separadores: "p u t o", "c.o.b.r.o.n".
    if (obfuscada.test(plano)) return true;
  }

  return false;
}

/**
 * Recorre un objeto/arreglo de campos y devuelve la ruta del primer campo
 * que contiene palabras prohibidas (o null si todo está limpio).
 */
export function campoConPalabrasProhibidas(
  valor: unknown,
  ruta = "",
): string | null {
  if (typeof valor === "string") {
    return contienePalabrasProhibidas(valor) ? ruta || "texto" : null;
  }

  if (Array.isArray(valor)) {
    for (let i = 0; i < valor.length; i++) {
      const encontrada = campoConPalabrasProhibidas(
        valor[i],
        ruta ? `${ruta}[${i}]` : String(i),
      );
      if (encontrada) return encontrada;
    }
    return null;
  }

  if (valor && typeof valor === "object") {
    for (const [clave, subValor] of Object.entries(valor)) {
      const encontrada = campoConPalabrasProhibidas(
        subValor,
        ruta ? `${ruta}.${clave}` : clave,
      );
      if (encontrada) return encontrada;
    }
  }

  return null;
}

export function mensajePalabrasProhibidas(campo: string): string {
  return `El campo "${campo}" contiene palabras no permitidas. Revisa tu texto antes de continuar.`;
}

/**
 * Filtro global: se aplica a todos los requests con cuerpo o parámetros de
 * búsqueda (mensajes, reportes, perfiles, notificaciones, login, etc.).
 * Las rutas multipart (registro y productos) validan en su controlador,
 * porque ahí Multer arma el cuerpo después de este middleware.
 */
export function filtroPalabrasProhibidas(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  for (const fuente of [req.body, req.query]) {
    if (!fuente || typeof fuente !== "object") continue;
    const campo = campoConPalabrasProhibidas(fuente);
    if (campo) {
      return res
        .status(400)
        .json({ message: mensajePalabrasProhibidas(campo), campo });
    }
  }
  next();
}
