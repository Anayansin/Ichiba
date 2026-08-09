import { Response, NextFunction } from "express";
import { Usuario } from "../models/usuario";
import { RequestConUsuario } from "./auth.js";

export async function requiereVerificado(
  req: RequestConUsuario,
  res: Response,
  next: NextFunction,
) {
  try {
    const usuario = await Usuario.findById(req.usuarioId);

    if (!usuario) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    if (!usuario.telefonoVerificado || !usuario.correoVerificado) {
      return res.status(403).json({
        message: "Debes verificar tu teléfono y correo antes de continuar",
        telefonoVerificado: usuario.telefonoVerificado,
        correoVerificado: usuario.correoVerificado,
      });
    }

    next();
  } catch (error) {
    console.error("Error real:", error);
    res.status(500).json({ message: "Error al validar la verificación" });
  }
}
