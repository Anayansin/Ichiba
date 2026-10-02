import { Response, NextFunction } from "express";
import { RequestConUsuario } from "./auth.js";
import { buscarUsuarioPorId } from "../services/usuarioService.js";

export async function esAdmin(
  req: RequestConUsuario,
  res: Response,
  next: NextFunction,
) {
  try {
    const usuario = await buscarUsuarioPorId(req.usuarioId);

    if (!usuario || usuario.tipo !== "admin") {
      return res
        .status(403)
        .json({ message: "Se requiere acceso de administrador" });
    }

    next();
  } catch (error) {
    console.error("Error real:", error);
    res.status(500).json({ message: "Error al verificar el acceso" });
  }
}
