import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface RequestConUsuario extends Request {
  usuarioId?: string;
}

export function verificarToken(
  req: RequestConUsuario,
  res: Response,
  next: NextFunction,
) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ message: "No autorizado, falta el token" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET as string) as {
      id: string;
    };
    req.usuarioId = payload.id;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Token inválido o expirado" });
  }
}
