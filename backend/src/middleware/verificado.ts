import { Response, NextFunction } from "express";
import { RequestConUsuario } from "./auth.js";
import { buscarUsuarioPorId } from "../services/usuarioService.js";
import { relojZonaCentro } from "../utils/validarHorario.js";

export async function requiereVerificado(
  req: RequestConUsuario,
  res: Response,
  next: NextFunction,
) {
  try {
    const usuario = await buscarUsuarioPorId(req.usuarioId);

    if (!usuario) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    if (!usuario.correoVerificado) {
      return res.status(403).json({
        message: "Debes verificar tu correo antes de continuar",
        correoVerificado: usuario.correoVerificado,
      });
    }

    // RQNF5.3: el "mes en curso" se calcula en zona centro (GMT-6), igual
    // que el horario del vendedor, sin importar la zona del servidor.
    const fechaConfirmacion = usuario.horarioConfirmadoEn;
    const hoy = relojZonaCentro(new Date());
    const confirmacion = fechaConfirmacion
      ? relojZonaCentro(fechaConfirmacion)
      : null;
    const horarioConfirmadoEsteMes =
      confirmacion &&
      confirmacion.getMonth() === hoy.getMonth() &&
      confirmacion.getFullYear() === hoy.getFullYear();

    if (!horarioConfirmadoEsteMes) {
      return res.status(403).json({
        message: "Debes confirmar tu horario de este mes antes de continuar",
      });
    }

    next();
  } catch (error) {
    console.error("Error real:", error);
    res.status(500).json({ message: "Error al validar la verificación" });
  }
}
