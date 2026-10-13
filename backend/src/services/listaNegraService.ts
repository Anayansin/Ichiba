import { ListaNegra } from "../models/ListaNegra.js";

export type DatosParaChequear = {
  rfc?: string | null;
  curp?: string | null;
  ineCodigoReverso?: string | null;
};

export type EntradaListaNegra = {
  id: string;
  rfc: string | null;
  curp: string | null;
  ineCodigoReverso: string | null;
  correo: string | null;
  nombreCompleto: string;
  motivo: string;
  origen: string;
  fecha: Date | null;
};

/**
 * Normaliza un valor alfanumérico (sin acentos, sin espacios y en
 * mayúsculas) para comparar RFC, CURP y el código del reverso de la INE.
 */
function normalizar(valor?: string | null): string | undefined {
  if (!valor) return undefined;
  const limpio = valor
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9Ñ<]/g, "");
  return limpio.length > 0 ? limpio : undefined;
}

/**
 * RQNF1.9: devuelve la entrada de la lista negra que coincida con el RFC,
 * la CURP o el código de la INE recibidos; si no hay coincidencia, null.
 */
export async function buscarEnListaNegra(
  datos: DatosParaChequear,
): Promise<EntradaListaNegra | null> {
  const rfc = normalizar(datos.rfc);
  const curp = normalizar(datos.curp);
  const ineCodigoReverso = normalizar(datos.ineCodigoReverso);

  if (!rfc && !curp && !ineCodigoReverso) return null;

  const condiciones: Record<string, unknown>[] = [];
  if (rfc) condiciones.push({ rfc });
  if (curp) condiciones.push({ curp });
  if (ineCodigoReverso) condiciones.push({ ineCodigoReverso: ineCodigoReverso });

  const entrada = await ListaNegra.findOne({ $or: condiciones })
    .sort({ createdAt: -1 })
    .lean();

  if (!entrada) return null;

  return resumirEntrada(entrada);
}

/**
 * Agrega una entrada a la lista negra. Omite los campos vacíos para no
 * chocar con los índices únicos de rfc y curp.
 */
export async function agregarAListaNegra(datos: {
  rfc?: string | null;
  curp?: string | null;
  ineCodigoReverso?: string | null;
  correo?: string | null;
  nombreCompleto?: string | null;
  motivo: string;
  origen?: "manual" | "cuenta-eliminada";
}): Promise<EntradaListaNegra> {
  const rfc = normalizar(datos.rfc);
  const curp = normalizar(datos.curp);
  const ineCodigoReverso = normalizar(datos.ineCodigoReverso);

  const creada = await ListaNegra.create({
    ...(rfc ? { rfc } : {}),
    ...(curp ? { curp } : {}),
    ...(ineCodigoReverso ? { ineCodigoReverso } : {}),
    ...(datos.correo ? { correo: datos.correo.trim() } : {}),
    nombreCompleto: (datos.nombreCompleto ?? "").trim(),
    motivo: datos.motivo.trim(),
    origen: datos.origen ?? "manual",
  });

  return resumirEntrada(creada.toObject());
}

export function resumirEntrada(entrada: {
  _id: unknown;
  rfc?: string | null;
  curp?: string | null;
  ineCodigoReverso?: string | null;
  correo?: string | null;
  nombreCompleto?: string;
  motivo: string;
  origen?: string;
  createdAt?: Date;
}): EntradaListaNegra {
  return {
    id: String(entrada._id),
    rfc: entrada.rfc ?? null,
    curp: entrada.curp ?? null,
    ineCodigoReverso: entrada.ineCodigoReverso ?? null,
    correo: entrada.correo ?? null,
    nombreCompleto: entrada.nombreCompleto ?? "",
    motivo: entrada.motivo,
    origen: entrada.origen ?? "manual",
    fecha: entrada.createdAt ?? null,
  };
}
