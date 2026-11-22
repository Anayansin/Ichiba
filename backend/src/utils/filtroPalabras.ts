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

export function normalizarParaFiltro(texto: string): string {
  return colapsarRepetidas(
    quitarAcentos(texto.toLowerCase()).replace(/[^a-z0-9ñ]+/g, " "),
  ).trim();
}

function planoParaFiltro(texto: string): string {
  return colapsarRepetidas(quitarAcentos(texto.toLowerCase()));
}

type Entrada = {
  palabra: string;
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
  if (campo === "contenido") {
    return "Tu mensaje no fue enviado porque contiene contenido no permitido. Corrígelo e inténtalo de nuevo.";
  }
  return `El campo "${campo}" contiene palabras no permitidas. Revisa tu texto antes de continuar.`;
}

export function filtroPalabrasProhibidas(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (req.path.startsWith("/api/pagos/webhook-paypal")) return next();
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
