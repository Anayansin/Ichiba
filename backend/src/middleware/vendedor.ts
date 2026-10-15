import { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { RequestConUsuario } from "./auth.js";
import { buscarUsuarioPorId } from "../services/usuarioService.js";

/**
 * El administrador es una cuenta de supervisión: revisa reportes, usuarios y
 * estadísticas, pero no publica, no vende, no confirma horarios ni vincula
 * métodos de pago. Estas acciones son exclusivas de los vendedores (todos
 * los usuarios que no son de tipo `admin`).
 */
export async function requiereVendedor(
  req: RequestConUsuario,
  res: Response,
  next: NextFunction,
) {
  try {
    const usuario = await buscarUsuarioPorId(req.usuarioId);

    if (!usuario) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    if (usuario.tipo === "admin") {
      return res.status(403).json({
        message:
          "Las cuentas administrativas no pueden publicar ni vender: su función es supervisar la plataforma",
      });
    }

    next();
  } catch (error) {
    console.error("Error real:", error);
    res.status(500).json({ message: "Error al validar el tipo de usuario" });
  }
}

/**
 * Las rutas de compra y de filas se identifican con la cabecera
 * `x-comprador-id` (no con la sesión), así que cuando la petición además
 * lleva el token de una cuenta administrativa se rechaza de entrada: el
 * administrador no compra en el marketplace.
 */
export function rechazarAdminEnCompra(
  req: RequestConUsuario,
  res: Response,
  next: NextFunction,
) {
  const cabecera = req.headers.authorization;

  if (cabecera?.startsWith("Bearer ")) {
    try {
      const payload = jwt.verify(
        cabecera.split(" ")[1],
        process.env.JWT_SECRET as string,
      ) as { tipo?: string };

      if (payload.tipo === "admin") {
        return res.status(403).json({
          message:
            "Las cuentas administrativas no pueden comprar en el marketplace",
        });
      }
    } catch {
      // Token ausente o inválido: el resto del flujo ya define qué hacer.
    }
  }

  next();
}
