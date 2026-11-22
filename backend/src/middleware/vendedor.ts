import { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { RequestConUsuario } from "./auth.js";
import { buscarUsuarioPorId } from "../services/usuarioService.js";

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

    if (usuario.estadoCuenta === "cancelada") {
      return res.status(403).json({
        message:
          "Tu cuenta fue cancelada de forma permanente: solo puedes completar las entregas cuyo pago ya está confirmado (RQNF10.3 / RQF12)",
      });
    }

    next();
  } catch (error) {
    console.error("Error real:", error);
    res.status(500).json({ message: "Error al validar el tipo de usuario" });
  }
}

export async function requiereVendedorDeEntregas(
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

export async function rechazarCuentaCancelada(
  req: RequestConUsuario,
  res: Response,
  next: NextFunction,
) {
  try {
    const usuario = await buscarUsuarioPorId(req.usuarioId);

    if (usuario?.estadoCuenta === "cancelada") {
      return res.status(403).json({
        message:
          "Tu cuenta fue cancelada de forma permanente: solo puedes completar las entregas cuyo pago ya está confirmado (RQNF10.3 / RQF12)",
      });
    }

    next();
  } catch (error) {
    console.error("Error real:", error);
    res.status(500).json({ message: "Error al validar el tipo de usuario" });
  }
}

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
    }
  }

  next();
}
