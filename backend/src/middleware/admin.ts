import { Request, Response, NextFunction } from "express";
import clientePrisma from "../configuracion/prisma.js";
import { RequestConUsuario } from "./auth.js";

/** Solo los usuarios con tipo "admin" pueden revisar y confirmar reportes. */
export async function requiereAdmin(
  req: RequestConUsuario,
  res: Response,
  next: NextFunction,
) {
  if (!req.usuarioId) {
    return res.status(401).json({ message: "No autorizado, falta el token" });
  }

  try {
    const usuario = await clientePrisma.usuario.findUnique({
      where: { id: Number(req.usuarioId) },
      select: { tipo: true },
    });

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
