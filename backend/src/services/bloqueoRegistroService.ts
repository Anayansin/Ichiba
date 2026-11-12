import clientePrisma from "../configuracion/prisma.js";
import { SolicitudRegistroBloqueado } from "../models/SolicitudRegistroBloqueado.js";
import {
  buscarEnListaNegra,
  normalizar,
  normalizarCorreo,
} from "./listaNegraService.js";

/**
 * Bloqueo del alta de una cuenta.
 *
 * Una cuenta nueva se deniega cuando:
 *   1. sus datos de identificación (RFC, CURP, código de la INE o correo)
 *      ya están en la lista negra (RQNF1.9);
 *   2. sus datos de identificación o su teléfono ya pertenecen a otra cuenta;
 *   3. su correo ya tiene una cuenta registrada.
 *
 * En los tres casos el registro se deniega con un mensaje claro: los datos
 * ingresados no pueden ser registrados y, si la persona cree que es un error,
 * puede solicitar la revisión a los administradores.
 */

/** Código que viaja en la respuesta para que el frontend lo identifique. */
export const CODIGO_DATOS_NO_REGISTRABLES = "DATOS_NO_REGISTRABLES";

export const MENSAJE_DATOS_NO_REGISTRABLES =
  "Los datos ingresados no pueden ser registrados. Si consideras que se trata de un error, comunícate con los administradores.";

export const MENSAJE_CORREO_EN_USO =
  "Ya existe una cuenta con ese correo, por eso los datos ingresados no pueden ser registrados. Si consideras que se trata de un error, comunícate con los administradores.";

export type MotivoBloqueoRegistro =
  | "lista-negra"
  | "datos-en-uso"
  | "correo-en-uso";

export type DatosParaRevisar = {
  rfc?: string | null;
  curp?: string | null;
  ineCodigoReverso?: string | null;
  correo?: string | null;
  telefono?: string | null;
};

export type RevisionBloqueoRegistro = {
  bloqueado: boolean;
  motivo: MotivoBloqueoRegistro | null;
  /** Campos que coincidieron. Se usa en el registro interno, no se muestra. */
  campos: string[];
};

/** Etiquetas legibles de cada campo, para el panel de administración. */
export const ETIQUETAS_CAMPOS: Record<string, string> = {
  rfc: "RFC",
  curp: "CURP",
  ineCodigoReverso: "Código de la INE",
  correo: "Correo",
  telefono: "Teléfono",
};

/** Texto que ve la persona según el motivo del bloqueo. */
export function mensajeDeBloqueoRegistro(
  motivo: MotivoBloqueoRegistro,
): string {
  return motivo === "correo-en-uso"
    ? MENSAJE_CORREO_EN_USO
    : MENSAJE_DATOS_NO_REGISTRABLES;
}

/**
 * Busca una cuenta que ya tenga ese dato. Se prueban las variantes de
 * mayúsculas y minúsculas porque el dato guardado depende de cómo lo
 * escribió la persona.
 */
async function existeCuentaCon(
  campo: "rfc" | "curp" | "ineCodigoReverso" | "telefono" | "correo",
  valor: string,
): Promise<boolean> {
  const variantes = new Set<string>();
  const limpio = valor.trim();
  if (!limpio) return false;

  variantes.add(limpio);
  if (campo !== "telefono") {
    variantes.add(limpio.toUpperCase());
    variantes.add(limpio.toLowerCase());
  }

  for (const variante of variantes) {
    const cuenta = await clientePrisma.usuario.findFirst({
      where: { [campo]: variante },
      select: { id: true },
    });
    if (cuenta) return true;
  }

  return false;
}

/**
 * Revisa los datos de un alta nueva y dice si debe quedar bloqueada.
 * La lista negra tiene prioridad: si el dato está ahí, no se registra
 * aunque además coincida con otra cuenta.
 */
export async function revisarBloqueoDeRegistro(
  datos: DatosParaRevisar,
): Promise<RevisionBloqueoRegistro> {
  const rfc = normalizar(datos.rfc);
  const curp = normalizar(datos.curp);
  const ineCodigoReverso = normalizar(datos.ineCodigoReverso);
  const correo = normalizarCorreo(datos.correo);
  const telefono = datos.telefono?.trim();

  // 1. Lista negra (RFC, CURP, código de la INE o correo).
  const entrada = await buscarEnListaNegra({
    rfc,
    curp,
    ineCodigoReverso,
    correo,
  });

  if (entrada) {
    const campos: string[] = [];
    if (rfc && entrada.rfc && normalizar(entrada.rfc) === rfc) campos.push("rfc");
    if (curp && entrada.curp && normalizar(entrada.curp) === curp) campos.push("curp");
    if (
      ineCodigoReverso &&
      entrada.ineCodigoReverso &&
      normalizar(entrada.ineCodigoReverso) === ineCodigoReverso
    ) {
      campos.push("ineCodigoReverso");
    }
    if (
      correo &&
      entrada.correo &&
      normalizarCorreo(entrada.correo) === correo
    ) {
      campos.push("correo");
    }

    return {
      bloqueado: true,
      motivo: "lista-negra",
      campos: campos.length > 0 ? campos : ["identificacion"],
    };
  }

  // 2. Los datos de identificación o el teléfono ya pertenecen a otra cuenta.
  const camposEnUso: string[] = [];
  if (rfc && (await existeCuentaCon("rfc", rfc))) camposEnUso.push("rfc");
  if (curp && (await existeCuentaCon("curp", curp))) camposEnUso.push("curp");
  if (
    ineCodigoReverso &&
    (await existeCuentaCon("ineCodigoReverso", ineCodigoReverso))
  ) {
    camposEnUso.push("ineCodigoReverso");
  }
  if (telefono && /^\d{10}$/.test(telefono)) {
    if (await existeCuentaCon("telefono", telefono)) camposEnUso.push("telefono");
  }

  if (camposEnUso.length > 0) {
    return { bloqueado: true, motivo: "datos-en-uso", campos: camposEnUso };
  }

  // 3. El correo ya tiene una cuenta registrada.
  if (correo && (await existeCuentaCon("correo", correo))) {
    return { bloqueado: true, motivo: "correo-en-uso", campos: ["correo"] };
  }

  return { bloqueado: false, motivo: null, campos: [] };
}

// ---------------------------------------------------------------------------
// Solicitud de revisión que la persona envía a los administradores.
// ---------------------------------------------------------------------------

export type SolicitudRevisionRegistro = {
  id: string;
  nombreCompleto: string;
  correo: string;
  telefono: string;
  rfc: string;
  motivoBloqueo: MotivoBloqueoRegistro;
  camposCoincidentes: string[];
  mensaje: string;
  estado: string;
  respuesta: string;
  revisadaPor: string;
  revisadaEn: string | null;
  fecha: string | null;
};

export type EstadoSolicitudRegistro =
  | "pendiente"
  | "en-revision"
  | "resuelta"
  | "descartada";

export type ListadoSolicitudesRegistro = {
  solicitudes: SolicitudRevisionRegistro[];
  pagina: number;
  porPagina: number;
  total: number;
  totalPaginas: number;
};

const SOLICITUDES_POR_PAGINA = 20;

export function resumirSolicitud(doc: {
  _id: unknown;
  nombreCompleto?: string;
  correo?: string;
  telefono?: string;
  rfc?: string;
  motivoBloqueo?: string;
  camposCoincidentes?: string[];
  mensaje?: string;
  estado?: string;
  respuesta?: string;
  revisadaPor?: string;
  revisadaEn?: Date | null;
  createdAt?: Date;
}): SolicitudRevisionRegistro {
  return {
    id: String(doc._id),
    nombreCompleto: doc.nombreCompleto ?? "",
    correo: doc.correo ?? "",
    telefono: doc.telefono ?? "",
    rfc: doc.rfc ?? "",
    motivoBloqueo: (doc.motivoBloqueo ?? "lista-negra") as MotivoBloqueoRegistro,
    camposCoincidentes: doc.camposCoincidentes ?? [],
    mensaje: doc.mensaje ?? "",
    estado: doc.estado ?? "pendiente",
    respuesta: doc.respuesta ?? "",
    revisadaPor: doc.revisadaPor ?? "",
    revisadaEn: doc.revisadaEn ? doc.revisadaEn.toISOString() : null,
    fecha: doc.createdAt ? doc.createdAt.toISOString() : null,
  };
}

/** Registra la solicitud de revisión que envía la persona bloqueada. */
export async function crearSolicitudDeRevision(datos: {
  nombreCompleto: string;
  correo: string;
  telefono?: string;
  rfc?: string;
  motivoBloqueo: MotivoBloqueoRegistro;
  camposCoincidentes?: string[];
  mensaje?: string;
}): Promise<SolicitudRevisionRegistro> {
  const creada = await SolicitudRegistroBloqueado.create({
    nombreCompleto: datos.nombreCompleto.trim(),
    correo: normalizarCorreo(datos.correo) ?? datos.correo.trim(),
    telefono: datos.telefono?.trim() ?? "",
    rfc: datos.rfc?.trim().toUpperCase() ?? "",
    motivoBloqueo: datos.motivoBloqueo,
    camposCoincidentes: datos.camposCoincidentes ?? [],
    mensaje: datos.mensaje?.trim() ?? "",
    estado: "pendiente",
  });

  return resumirSolicitud(creada.toObject());
}

/** Listado para el BackOffice. */
export async function listarSolicitudesDeRevision(opciones: {
  pagina?: number;
  porPagina?: number;
  estado?: string;
}): Promise<ListadoSolicitudesRegistro> {
  const pagina = Math.max(Number(opciones.pagina) || 1, 1);
  const porPagina = Math.max(
    Number(opciones.porPagina) || SOLICITUDES_POR_PAGINA,
    1,
  );

  const filtro = opciones.estado
    ? { estado: opciones.estado as EstadoSolicitudRegistro }
    : {};

  const [solicitudes, total] = await Promise.all([
    SolicitudRegistroBloqueado.find(filtro)
      .sort({ createdAt: -1 })
      .skip((pagina - 1) * porPagina)
      .limit(porPagina)
      .lean(),
    SolicitudRegistroBloqueado.countDocuments(filtro),
  ]);

  return {
    solicitudes: solicitudes.map(resumirSolicitud),
    pagina,
    porPagina,
    total,
    totalPaginas: Math.max(Math.ceil(total / porPagina), 1),
  };
}

/** El administrador revisa la solicitud y deja su respuesta. */
export async function resolverSolicitudDeRevision(
  id: string,
  datos: {
    estado: "en-revision" | "resuelta" | "descartada";
    respuesta?: string;
    revisadaPor?: string;
  },
): Promise<SolicitudRevisionRegistro | null> {
  const actualizada = await SolicitudRegistroBloqueado.findByIdAndUpdate(
    id,
    {
      $set: {
        estado: datos.estado,
        respuesta: datos.respuesta?.trim() ?? "",
        revisadaPor: datos.revisadaPor?.trim() ?? "",
        revisadaEn: new Date(),
      },
    },
    { returnDocument: "after" },
  ).lean();

  return actualizada ? resumirSolicitud(actualizada) : null;
}
