import fs from "fs";
import path from "path";

export type DatosINE = {
  surname?: string;
  given_names?: string;
  address?: string;
  document_number?: string;
  personal_number?: string;
  additional_fields?: {
    mrz_line_1?: string | null;
    mrz_line_2?: string | null;
    mrz_line_3?: string | null;
    phone_number?: string | null;
    tramite_number?: string | null;
    ejemplar?: string | null;
  };
};

export async function extraerDatosINE(rutaArchivo: string): Promise<DatosINE> {
  const buffer = fs.readFileSync(rutaArchivo);
  const base64 = buffer.toString("base64");

  const extension = path.extname(rutaArchivo).toLowerCase();
  const mimeType = extension === ".png" ? "image/png" : "image/jpeg";

  const respuesta = await fetch("https://api.structocr.com/v1/national-id", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.STRUCTOCR_API_KEY as string,
    },
    body: JSON.stringify({ img: `data:${mimeType};base64,${base64}` }),
  });

  if (!respuesta.ok) {
    throw new Error(`StructOCR respondió con estado ${respuesta.status}`);
  }

  const json = await respuesta.json();

  if (!json.success) {
    throw new Error("StructOCR no pudo extraer los datos de la identificación");
  }

  return json.data;
}

function normalizar(texto: string): string {
  return texto
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function coincideNombreConDatosINE(
  datos: DatosINE,
  nombreCompleto: string,
): boolean {
  const nombreEnIne = normalizar(
    `${datos.given_names || ""} ${datos.surname || ""}`,
  );
  const palabrasNombre = normalizar(nombreCompleto)
    .split(" ")
    .filter((palabra) => palabra.length > 2);

  if (palabrasNombre.length === 0 || nombreEnIne.length === 0) return false;

  const coincidencias = palabrasNombre.filter((palabra) =>
    nombreEnIne.includes(palabra),
  );
  return coincidencias.length / palabrasNombre.length >= 0.7;
}
