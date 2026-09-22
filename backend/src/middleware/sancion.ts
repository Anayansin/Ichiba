import { Response, NextFunction } from "express";
import { RequestConComprador } from "./comprador.js";
import { RequestConUsuario } from "./auth.js";
import { Sancion } from "../models/Sancion.js";
import { estadoBloqueo, EstadoBloqueo, sancionDe } from "../services/sancionService.js";

function responderBloqueo(res: Response, estado: EstadoBloqueo) {
  const motivo = estado.permanente
    ? "Bloqueo permanente por reincidencia de faltas graves."
    : `Se levantará el ${
        estado.hasta ? new Date(estado.hasta).toLocaleString("es-MX") : ""
      }.`;

  return res.status(403).json({
    message: `Tu cuenta tiene una sanción activa y no puedes realizar esta acción. ${motivo}`,
    sancion: {
      permanente: estado.permanente,
      hasta: estado.hasta,
      faltasLeves: estado.faltasLeves,
      faltasGraves: estado.faltasGraves,
    },
  });
}

async function validarSancion(
  res: Response,
  sujetoTipo: "usuario" | "comprador",
  sujetoId: string | undefined,
  next: NextFunction,
) {
  try {
    const sancion = await sancionDe(sujetoTipo, sujetoId);
    const estado = estadoBloqueo(sancion);
    if (estado.bloqueada) {
      return responderBloqueo(res, estado);
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

/** Consulta la sanción vigente de un sujeto (para mostrarla en la UI). */
export async function obtenerEstadoDeSancion(
  sujetoTipo: "usuario" | "comprador",
  sujetoId: string,
): Promise<EstadoBloqueo | null> {
  const sancion = await Sancion.findOne({ sujetoTipo, sujetoId });
  if (!sancion) return null;
  return estadoBloqueo(sancion);
}
