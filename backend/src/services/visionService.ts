import fs from "fs";

const ENDPOINT_POR_DEFECTO =
  "https://vision.googleapis.com/v1/images:annotate";

function endpointVision(): string {
  if (process.env.NODE_ENV === "production") {
    if (process.env.GOOGLE_VISION_ENDPOINT) {
      console.error(
        "[vision] GOOGLE_VISION_ENDPOINT está definido en producción; se ignora y se usa el endpoint oficial.",
      );
    }
    return ENDPOINT_POR_DEFECTO;
  }
  return process.env.GOOGLE_VISION_ENDPOINT || ENDPOINT_POR_DEFECTO;
}

const ENDPOINT = endpointVision();

function moderacionOmitida(): boolean {
  if (process.env.VISION_MODERACION !== "omitir") return false;
  if (process.env.NODE_ENV === "production") {
    console.error(
      "[vision] VISION_MODERACION=omitir está definido en producción; se ignora y la moderación sigue activa.",
    );
    return false;
  }
  return true;
}

const UMBRAL_CONFIANZA = 0.7;

const ETIQUETAS_EXCLUIDAS: { categoria: string; etiquetas: string[] }[] = [
  {
    categoria: "carros",
    etiquetas: [
      "car",
      "automobile",
      "sedan",
      "sports car",
      "convertible",
      "truck",
      "pickup truck",
      "van",
      "limousine",
      "taxi",
      "police car",
      "ambulance",
      "fire truck",
    ],
  },
  {
    categoria: "motos",
    etiquetas: ["motorcycle", "motorbike", "scooter", "moped"],
  },
  {
    categoria: "casas",
    etiquetas: ["house", "home", "cottage", "villa", "mansion", "cabin"],
  },
  {
    categoria: "terrenos",
    etiquetas: ["field", "pasture", "farmland", "meadow", "parcel", "terrain"],
  },
  {
    categoria: "mascotas",
    etiquetas: [
      "dog",
      "cat",
      "pet",
      "puppy",
      "kitten",
      "hamster",
      "rabbit",
      "bird",
    ],
  },
  {
    categoria: "personas",
    etiquetas: [
      "person",
      "human",
      "face",
      "man",
      "woman",
      "girl",
      "boy",
      "people",
      "portrait",
      "selfie",
      "child",
      "baby",
    ],
  },
  {
    categoria: "armas",
    etiquetas: [
      "weapon",
      "gun",
      "pistol",
      "rifle",
      "firearm",
      "handgun",
      "shotgun",
      "ammunition",
      "bullet",
      "sword",
      "dagger",
      "grenade",
      "bomb",
    ],
  },
  {
    categoria: "sustancias controladas",
    etiquetas: [
      "drug",
      "narcotic",
      "marijuana",
      "cannabis",
      "weed",
      "cocaine",
      "heroin",
      "methamphetamine",
      "drug paraphernalia",
    ],
  },
  {
    categoria: "productos perecederos",
    etiquetas: [
      "food",
      "fruit",
      "vegetable",
      "meat",
      "fish",
      "bread",
      "pastry",
      "cake",
      "dessert",
      "salad",
      "produce",
      "seafood",
      "fast food",
    ],
  },
];

function contienePalabraCompleta(texto: string, palabra: string): boolean {
  const escapada = palabra.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escapada}([^a-z0-9]|$)`, "i").test(texto);
}

export function categoriaExcluidaPorEtiqueta(etiqueta: string): string | null {
  const limpia = etiqueta.trim();
  if (!limpia) return null;

  for (const grupo of ETIQUETAS_EXCLUIDAS) {
    for (const prohibida of grupo.etiquetas) {
      if (contienePalabraCompleta(limpia, prohibida)) {
        return grupo.categoria;
      }
    }
  }
  return null;
}

type AnalisisFoto = {
  permitido: boolean;
  motivo?: "no-configurada" | "error" | "excluido";
  categoria?: string;
};

async function analizarFotoProducto(rutaArchivo: string): Promise<AnalisisFoto> {
  const clave = process.env.GOOGLE_VISION_API_KEY;
  if (!clave) return { permitido: false, motivo: "no-configurada" };

  try {
    const base64 = fs.readFileSync(rutaArchivo).toString("base64");

    const respuesta = await fetch(`${ENDPOINT}?key=${clave}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [
          {
            image: { content: base64 },
            features: [{ type: "LABEL_DETECTION", maxResults: 20 }],
          },
        ],
      }),
    });

    if (!respuesta.ok) {
      console.error(`[vision] Cloud Vision respondió ${respuesta.status}`);
      return { permitido: false, motivo: "error" };
    }

    const json = (await respuesta.json()) as {
      responses?: {
        labelAnnotations?: { description?: string; score?: number }[];
      }[];
    };

    const etiquetas = json?.responses?.[0]?.labelAnnotations ?? [];
    for (const etiqueta of etiquetas) {
      if ((etiqueta.score ?? 0) < UMBRAL_CONFIANZA) continue;
      const categoria = categoriaExcluidaPorEtiqueta(
        etiqueta.description ?? "",
      );
      if (categoria) {
        return { permitido: false, motivo: "excluido", categoria };
      }
    }

    return { permitido: true };
  } catch (error) {
    console.error(
      "[vision] No se pudo analizar la foto:",
      error instanceof Error ? error.message : error,
    );
    return { permitido: false, motivo: "error" };
  }
}

export async function moderarFotosProducto(
  rutasArchivos: string[],
): Promise<string | null> {
  if (moderacionOmitida()) return null;

  for (const ruta of rutasArchivos) {
    const analisis = await analizarFotoProducto(ruta);
    if (analisis.permitido) continue;

    if (analisis.motivo === "no-configurada") {
      console.error(
        "[vision] Falta GOOGLE_VISION_API_KEY: la moderación de fotos está activa y bloquea publicaciones (RQNF7.3).",
      );
      return "La moderación de imágenes no está disponible en este momento; no se puede publicar. Intenta más tarde o contacta al administrador.";
    }

    if (analisis.motivo === "error") {
      return "No fue posible analizar la fotografía en este momento; intenta de nuevo.";
    }

    return `La fotografía contiene un artículo excluido del catálogo (${analisis.categoria}). Los carros, motos, casas, terrenos, mascotas, personas, armas, sustancias controladas y productos perecederos se anuncian en la zona de promocionales.`;
  }

  return null;
}

type AnalisisSeguro = {
  permitido: boolean;
  motivo?: "no-configurada" | "error" | "inapropiado";
};

async function analizarContenidoInseguro(
  rutaArchivo: string,
): Promise<AnalisisSeguro> {
  const clave = process.env.GOOGLE_VISION_API_KEY;
  if (!clave) return { permitido: false, motivo: "no-configurada" };

  try {
    const base64 = fs.readFileSync(rutaArchivo).toString("base64");

    const respuesta = await fetch(`${ENDPOINT}?key=${clave}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [
          {
            image: { content: base64 },
            features: [{ type: "SAFE_SEARCH_DETECTION" }],
          },
        ],
      }),
    });

    if (!respuesta.ok) {
      console.error(
        `[vision] Cloud Vision (SafeSearch) respondió ${respuesta.status}`,
      );
      return { permitido: false, motivo: "error" };
    }

    const json = (await respuesta.json()) as {
      responses?: {
        safeSearchAnnotation?: {
          adult?: string;
          spoof?: string;
          violence?: string;
          racy?: string;
        };
      }[];
    };

    const anotacion = json?.responses?.[0]?.safeSearchAnnotation ?? {};
    const valores = [anotacion.adult, anotacion.violence];
    const muyProbable = (valor?: string) =>
      valor === "LIKELY" || valor === "VERY_LIKELY";

    if (valores.some(muyProbable) || anotacion.racy === "VERY_LIKELY") {
      return { permitido: false, motivo: "inapropiado" };
    }

    return { permitido: true };
  } catch (error) {
    console.error(
      "[vision] No se pudo analizar el comprobante:",
      error instanceof Error ? error.message : error,
    );
    return { permitido: false, motivo: "error" };
  }
}

export type VerificacionComprobante = {
  verificado: boolean;
  motivo?:
    | "no-configurada"
    | "error"
    | "sin-texto"
    | "referencia"
    | "monto"
    | "fecha";
};

function normalizarParaComparar(texto: string): string {
  return texto.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

const MESES = [
  "ENE",
  "FEB",
  "MAR",
  "ABR",
  "MAY",
  "JUN",
  "JUL",
  "AGO",
  "SEP",
  "OCT",
  "NOV",
  "DIC",
];

function elTextoTieneFecha(texto: string): boolean {
  const tieneNumero = /\b\d{1,4}[/\-.]\d{1,2}[/\-.]\d{1,4}\b/.test(texto);
  if (tieneNumero) return true;
  const enMayusculas = texto.toUpperCase();
  return MESES.some((mes) => enMayusculas.includes(mes));
}

function elTextoTieneElMonto(texto: string, monto: number): boolean {
  const esperado = Math.abs(Number(monto) || 0);
  if (esperado <= 0) return true;
  const tolerancia = Math.max(1, esperado * 0.02);
  for (const coincidencia of texto.match(/\d[\d.,]*/g) ?? []) {
    const numero = Number(coincidencia.replace(/,/g, ""));
    if (!Number.isFinite(numero) || numero <= 0) continue;
    if (Math.abs(numero - esperado) <= tolerancia) return true;
    if (Math.abs(numero / 100 - esperado) <= tolerancia) return true;
  }
  return false;
}

export async function verificarComprobanteConTexto(
  rutaArchivo: string,
  esperado: { referencia: string; monto: number },
): Promise<VerificacionComprobante> {
  if (moderacionOmitida()) return { verificado: true };

  const clave = process.env.GOOGLE_VISION_API_KEY;
  if (!clave) return { verificado: false, motivo: "no-configurada" };

  try {
    const base64 = fs.readFileSync(rutaArchivo).toString("base64");

    const respuesta = await fetch(`${ENDPOINT}?key=${clave}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [
          {
            image: { content: base64 },
            features: [{ type: "TEXT_DETECTION" }],
          },
        ],
      }),
    });

    if (!respuesta.ok) {
      console.error(`[vision] Cloud Vision (texto) respondió ${respuesta.status}`);
      return { verificado: false, motivo: "error" };
    }

    const json = (await respuesta.json()) as {
      responses?: { textAnnotations?: { description?: string }[] }[];
    };

    const texto = (json?.responses?.[0]?.textAnnotations ?? [])
      .map((anotacion) => anotacion.description ?? "")
      .join("\n");

    if (!texto.trim()) return { verificado: false, motivo: "sin-texto" };

    const referenciaEsperada = normalizarParaComparar(esperado.referencia);
    if (
      !referenciaEsperada ||
      !normalizarParaComparar(texto).includes(referenciaEsperada)
    ) {
      return { verificado: false, motivo: "referencia" };
    }

    if (!elTextoTieneElMonto(texto, esperado.monto)) {
      return { verificado: false, motivo: "monto" };
    }

    if (!elTextoTieneFecha(texto)) {
      return { verificado: false, motivo: "fecha" };
    }

    return { verificado: true };
  } catch (error) {
    console.error(
      "[vision] No se pudo leer el texto del comprobante:",
      error instanceof Error ? error.message : error,
    );
    return { verificado: false, motivo: "error" };
  }
}

export function mensajeDeVerificacionComprobante(
  motivo: NonNullable<VerificacionComprobante["motivo"]>,
): string {
  if (motivo === "no-configurada") {
    return "No se puede verificar el comprobante en este momento; no se puede enviar. Intenta más tarde o contacta al administrador.";
  }
  if (motivo === "error") {
    return "No fue posible leer el comprobante en este momento; intenta de nuevo.";
  }
  if (motivo === "sin-texto") {
    return "No se leyó ningún dato en la imagen del comprobante. Sube una captura legible donde se vean la referencia, el monto y la fecha.";
  }
  if (motivo === "referencia") {
    return "La referencia del comprobante no coincide con la que escribiste. Revisa la imagen y vuelve a intentarlo.";
  }
  if (motivo === "monto") {
    return "El monto del comprobante no coincide con el total de la compra. Revisa la imagen y vuelve a intentarlo.";
  }
  return "No se encontró una fecha legible en el comprobante. Sube una imagen donde se vea la fecha de la operación.";
}

export async function moderarComprobante(
  rutaArchivo: string,
  contexto: "comprobante" | "chat" = "comprobante",
): Promise<string | null> {
  if (moderacionOmitida()) return null;

  const analisis = await analizarContenidoInseguro(rutaArchivo);
  if (analisis.permitido) return null;

  const esChat = contexto === "chat";

  if (analisis.motivo === "no-configurada") {
    console.error(
      `[vision] Falta GOOGLE_VISION_API_KEY: la moderación de ${esChat ? "imágenes del chat" : "comprobantes"} está activa y bloquea el envío (RQNF18/RNF-CHA-03).`,
    );
    return esChat
      ? "La moderación de imágenes no está disponible en este momento; no se puede enviar la imagen del chat. Intenta más tarde o contacta al administrador."
      : "La moderación de imágenes no está disponible en este momento; no se puede enviar el comprobante. Intenta más tarde o contacta al administrador.";
  }

  if (analisis.motivo === "error") {
    return esChat
      ? "No fue posible analizar la imagen del chat en este momento; intenta de nuevo."
      : "No fue posible analizar tu comprobante en este momento; intenta de nuevo.";
  }

  return esChat
    ? "La imagen del chat contiene contenido inapropiado y no puede enviarse."
    : "La imagen del comprobante contiene contenido inapropiado y no puede enviarse.";
}
