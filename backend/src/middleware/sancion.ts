import { Response, NextFunction } from "express";
import { RequestConComprador } from "./comprador.js";
import { RequestConUsuario } from "./auth.js";
import { Sancion } from "../models/Sancion.js";
import clientePrisma from "../configuracion/prisma.js";
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

  const detalleRevision = estado.motivoRevision
    ? ` Motivo: ${estado.motivoRevision}.`
    : "";

  return res.status(403).json({
    message: `Tu cuenta tiene una sanción activa y no puedes realizar esta acción. ${motivo}${detalleRevision}`,
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

function responderSuspension(
  res: Response,
  suspension: { motivoSuspension?: string | null; saldoPendiente?: number | null },
) {
  const motivo = suspension.motivoSuspension
    ? String(suspension.motivoSuspension)
    : null;
  const saldo = Number(suspension.saldoPendiente ?? 0);
  const detalle =
    motivo && motivo !== "manual" && motivo !== "saldo_pendiente"
      ? ` Motivo: ${motivo}.`
      : "";

  return res.status(403).json({
    message:
      motivo === "saldo_pendiente"
        ? `Tu cuenta está suspendida por un saldo pendiente de $${saldo.toFixed(
            2,
          )}. Puedes terminar tus entregas en curso, pero no publicar ni recibir clientes hasta que la administración registre la liquidación.`
        : `Tu cuenta está suspendida por la administración de Ichiba.${detalle} Contacta al equipo para revisar tu caso y solicitar la reactivación.`,
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
    const sancion = await sancionDe(sujetoTipo, sujetoId);
    const estado = estadoBloqueo(sancion);
    if (estado.bloqueada) {
      return responderBloqueo(res, estado);
    }

    if (sujetoTipo === "usuario") {
      const id = Number(sujetoId);
      if (Number.isInteger(id)) {
        const cuenta = await clientePrisma.usuario.findUnique({
          where: { id },
          select: {
            suspendido: true,
            motivoSuspension: true,
            saldoPendiente: true,
          },
        });

        if (cuenta?.suspendido) {
          const esSaldo = String(cuenta.motivoSuspension ?? "") === "saldo_pendiente";
          if (!(opciones?.permitirSuspensionPorSaldo && esSaldo)) {
            return responderSuspension(res, cuenta);
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

export function requiereCompradorSinSancion(
  req: RequestConComprador,
  res: Response,
  next: NextFunction,
) {
  return validarSancion(res, "comprador", req.compradorId, next);
}

export function requiereUsuarioSinSancion(
  req: RequestConUsuario,
  res: Response,
  next: NextFunction,
) {
  return validarSancion(res, "usuario", req.usuarioId, next);
}

export function requiereUsuarioSinSancionDeEntregas(
  req: RequestConUsuario,
  res: Response,
  next: NextFunction,
) {
  return validarSancion(res, "usuario", req.usuarioId, next, {
    permitirSuspensionPorSaldo: true,
  });
}

export async function obtenerEstadoDeSancion(
  sujetoTipo: "usuario" | "comprador",
  sujetoId: string,
): Promise<EstadoBloqueo | null> {
  const sancion = await Sancion.findOne({ sujetoTipo, sujetoId });
  if (!sancion) return null;
  return estadoBloqueo(sancion);
}
