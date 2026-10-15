import fs from "fs";

/**
 * RQNF7.3 — Moderación de las fotografías de productos con la Cloud Vision
 * API de Google.
 *
 * Analiza cada imagen con detección de etiquetas y bloquea la publicación
 * cuando reconoce artículos excluidos del catálogo: carros, motos, casas,
 * terrenos, mascotas, personas, armas, sustancias controladas o productos
 * perecederos (esos anuncios van a la zona de promocionales, no al catálogo).
 *
 * Requiere GOOGLE_VISION_API_KEY (Google Cloud → Cloud Vision API →
 * credenciales). GOOGLE_VISION_ENDPOINT y VISION_MODERACION="omitir" solo
 * existen para pruebas y para desarrollo local sin llave.
 */

const ENDPOINT =
  process.env.GOOGLE_VISION_ENDPOINT ||
  "https://vision.googleapis.com/v1/images:annotate";

/** Confianza mínima de la etiqueta para tomar la decisión. */
const UMBRAL_CONFIANZA = 0.7;

/**
 * Etiquetas en inglés (las que devuelve Vision) que señalan artículos
 * excluidos, agrupadas por categoría. La comparación es por palabra
 * completa: "sports car" coincide con "car", pero "carpet" no.
 */
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

/** Devuelve la categoría excluida que corresponde a una etiqueta de Vision. */
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
  /** Por qué se bloqueó: sin llave, fallo del servicio o artículo excluido. */
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

/**
 * Analiza todas las fotos subidas de un producto. Devuelve el mensaje en
 * español del bloqueo, o null si todo está permitido.
 *
 * RQNF7.3: si la moderación no puede ejecutarse (sin llave o con error de
 * Cloud Vision), la publicación queda bloqueada —nunca se publica sin
 * analizar— a menos que VISION_MODERACION="omitir" (solo desarrollo local).
 */
export async function moderarFotosProducto(
  rutasArchivos: string[],
): Promise<string | null> {
  if (process.env.VISION_MODERACION === "omitir") return null;

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

/**
 * RQNF18 (para RQF22): moderación de contenido de las imágenes de
 * comprobante con la detección de contenido inseguro (SafeSearch) de Cloud
 * Vision. Debe correr ANTES de mostrársela al vendedor.
 */
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

/**
 * Analiza la fotografía del comprobante de pago. Devuelve el mensaje en
 * español del bloqueo, o null si está permitida.
 *
 * Igual que RQNF7.3: si la moderación no puede ejecutarse (sin llave o con
 * error de Cloud Vision) la imagen queda bloqueada —nunca se muestra al
 * vendedor sin analizar— a menos que VISION_MODERACION="omitir".
 */
export async function moderarComprobante(
  rutaArchivo: string,
): Promise<string | null> {
  if (process.env.VISION_MODERACION === "omitir") return null;

  const analisis = await analizarContenidoInseguro(rutaArchivo);
  if (analisis.permitido) return null;

  if (analisis.motivo === "no-configurada") {
    console.error(
      "[vision] Falta GOOGLE_VISION_API_KEY: la moderación de comprobantes está activa y bloquea el envío (RQNF18).",
    );
    return "La moderación de imágenes no está disponible en este momento; no se puede enviar el comprobante. Intenta más tarde o contacta al administrador.";
  }

  if (analisis.motivo === "error") {
    return "No fue posible analizar tu comprobante en este momento; intenta de nuevo.";
  }

  return "La imagen del comprobante contiene contenido inapropiado y no puede enviarse.";
}
