import { Request, Response, NextFunction } from "express";

export interface RequestConComprador extends Request {
  compradorId?: string;
}

export function requiereCompradorId(
  req: RequestConComprador,
  res: Response,
  next: NextFunction,
) {
  const compradorId = req.headers["x-comprador-id"] as string;

  if (!compradorId) {
    return res
      .status(400)
      .json({ message: "Falta identificador de comprador" });
  }

  req.compradorId = compradorId;
  next();
}
