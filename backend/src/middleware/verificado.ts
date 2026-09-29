import { Response, NextFunction } from "express";
import { RequestConUsuario } from "./auth.js";
import { buscarUsuarioPorId } from "../services/usuarioService.js";

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

    const mesActual = new Date().getMonth();
    const anioActual = new Date().getFullYear();
    const fechaConfirmacion = usuario.horarioConfirmadoEn;
    const horarioConfirmadoEsteMes =
      fechaConfirmacion &&
      fechaConfirmacion.getMonth() === mesActual &&
      fechaConfirmacion.getFullYear() === anioActual;

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
