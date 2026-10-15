import { Response, NextFunction } from "express";
import { RequestConComprador } from "./comprador.js";
import { RequestConUsuario } from "./auth.js";
import { Sancion } from "../models/Sancion.js";
import { Usuario } from "../models/usuario.js";
import { estadoBloqueo, EstadoBloqueo, sancionDe } from "../services/sancionService.js";

function responderBloqueo(res: Response, estado: EstadoBloqueo) {
  let motivo: string;
  if (estado.revisionAdministrativa) {
    motivo =
      "Tu caso está en revisión administrativa: el equipo de Ichiba analizará la situación y podrá levantar la suspensión.";
  } else if (estado.permanente) {
    motivo = "Bloqueo permanente por reincidencia de faltas graves.";
  } else {
    motivo = `Se levantará el ${
      estado.hasta ? new Date(estado.hasta).toLocaleString("es-MX") : ""
    } de forma automática.`;
  }

  return res.status(403).json({
    message: `Tu cuenta tiene una sanción activa y no puedes realizar esta acción. ${motivo}`,
    sancion: {
      permanente: estado.permanente,
      hasta: estado.hasta,
      faltasLeves: estado.faltasLeves,
      faltasGraves: estado.faltasGraves,
      revisionAdministrativa: estado.revisionAdministrativa,
      motivoRevision: estado.motivoRevision,
    },
  });
}

/**
 * RQNF37 / RQNF38: suspensión administrativa registrada en el BackOffice
 * (espejo de MongoDB). La suspensión por saldo pendiente permite únicamente
 * terminar entregas en curso, así que algunas rutas (chat de coordinación)
 * la toleran con `permitirSuspensionPorSaldo`.
 */
function responderSuspension(
  res: Response,
  suspension: { motivoSuspension?: string | null; saldoPendiente?: number | null },
) {
  const motivo = suspension.motivoSuspension
    ? String(suspension.motivoSuspension)
    : null;
  const saldo = Number(suspension.saldoPendiente ?? 0);

  return res.status(403).json({
    message:
      motivo === "saldo_pendiente"
        ? `Tu cuenta está suspendida por un saldo pendiente de $${saldo.toFixed(
            2,
          )}. Puedes terminar tus entregas en curso, pero no publicar ni recibir clientes hasta que la administración registre la liquidación (RQNF37 / RQNF38).`
        : "Tu cuenta está suspendida por la administración de Ichiba. Contacta al equipo para más información.",
    sancion: {
      permanente: true,
      hasta: null,
      faltasLeves: 0,
      faltasGraves: 0,
      motivoSuspension: motivo,
      saldoPendiente: saldo,
    },
  });
}

async function validarSancion(
  res: Response,
  sujetoTipo: "usuario" | "comprador",
  sujetoId: string | undefined,
  next: NextFunction,
  opciones?: { permitirSuspensionPorSaldo?: boolean },
) {
  try {
    // 1) Sanciones por faltas (RQNF33 / RQNF34 / RQNF35).
    const sancion = await sancionDe(sujetoTipo, sujetoId);
    const estado = estadoBloqueo(sancion);
    if (estado.bloqueada) {
      return responderBloqueo(res, estado);
    }

    // 2) Suspensión administrativa del BackOffice (RQNF37 / RQNF38).
    if (sujetoTipo === "usuario") {
      const id = Number(sujetoId);
      if (Number.isInteger(id)) {
        const espejo = await Usuario.findOne({ usuarioId: id })
          .select("suspendido motivoSuspension saldoPendiente")
          .lean();

        if (espejo?.suspendido) {
          const esSaldo = String(espejo.motivoSuspension ?? "") === "saldo_pendiente";
          if (!(opciones?.permitirSuspensionPorSaldo && esSaldo)) {
            return responderSuspension(res, espejo);
          }
        }
      }
    }

    next();
  } catch (error) {
    console.error("Error real:", error);
    res.status(500).json({ message: "Error al validar sanciones" });
  }
}

/** Bloquea a compradores sancionados (entrar a filas, mensajes, etc.). */
export function requiereCompradorSinSancion(
  req: RequestConComprador,
  res: Response,
  next: NextFunction,
) {
  return validarSancion(res, "comprador", req.compradorId, next);
}

/** Bloquea a vendedores sancionados (publicar/editar productos, etc.). */
export function requiereUsuarioSinSancion(
  req: RequestConUsuario,
  res: Response,
  next: NextFunction,
) {
  return validarSancion(res, "usuario", req.usuarioId, next);
}

/**
 * RQNF38: variante para las rutas de coordinación de una entrega en curso:
 * tolera la suspensión por saldo pendiente (el vendedor necesita el chat para
 * terminar sus entregas), pero no las demás suspensiones ni los bloqueos por
 * faltas.
 */
export function requiereUsuarioSinSancionDeEntregas(
  req: RequestConUsuario,
  res: Response,
  next: NextFunction,
) {
  return validarSancion(res, "usuario", req.usuarioId, next, {
    permitirSuspensionPorSaldo: true,
  });
}

/** Consulta la sanción vigente de un sujeto (para mostrarla en la UI). */
export async function obtenerEstadoDeSancion(
  sujetoTipo: "usuario" | "comprador",
  sujetoId: string,
): Promise<EstadoBloqueo | null> {
  const sancion = await Sancion.findOne({ sujetoTipo, sujetoId });
  if (!sancion) return null;
  return estadoBloqueo(sancion);
}
