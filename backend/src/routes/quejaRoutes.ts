import { Router, type Request, type Response } from "express";
import jwt from "jsonwebtoken";
import clientePrisma from "../configuracion/prisma.js";
import { Queja, ASUNTOS_QUEJA } from "../models/Queja.js";
import { FORMATO_CORREO } from "../utils/formatoCorreo.js";

const router = Router();

const MENSAJE_MINIMO = 20;
const MENSAJE_MAXIMO = 1000;

// Cualquier persona (con sesión o como comprador) puede enviar una queja.
router.post("/", async (req: Request, res: Response) => {
  try {
    let autor: { tipo: "usuario" | "comprador"; id: string } | null = null;
    const cabecera = req.headers.authorization;
    if (cabecera) {
      try {
        const datos = jwt.verify(
          cabecera.split(" ")[1],
          process.env.JWT_SECRET as string,
        ) as { id: string | number };
        autor = { tipo: "usuario", id: String(datos.id) };
      } catch {
        autor = null;
      }
    }
    const compradorId = req.headers["x-comprador-id"];
    if (!autor && typeof compradorId === "string" && compradorId) {
      autor = { tipo: "comprador", id: compradorId };
    }
    if (!autor) {
      return res.status(401).json({ message: "No pudimos identificarte" });
    }

    const asunto = String(req.body?.asunto ?? "");
    const mensaje = String(req.body?.mensaje ?? "").trim();
    const referencia = String(req.body?.referencia ?? "").trim().slice(0, 120);
    let nombre = String(req.body?.nombre ?? "").trim().slice(0, 120);
    let correo = String(req.body?.correo ?? "").trim().toLowerCase();

    if (!(ASUNTOS_QUEJA as readonly string[]).includes(asunto)) {
      return res.status(400).json({ message: "Elige el tema de tu queja" });
    }
    if (mensaje.length < MENSAJE_MINIMO || mensaje.length > MENSAJE_MAXIMO) {
      return res.status(400).json({
        message: `Describe tu queja en ${MENSAJE_MINIMO} a ${MENSAJE_MAXIMO} caracteres`,
      });
    }

    if (autor.tipo === "usuario") {
      const usuario = await clientePrisma.usuario.findUnique({
        where: { id: Number(autor.id) },
        select: { nombreCompleto: true, correo: true },
      });
      nombre = usuario?.nombreCompleto ?? nombre;
      correo = usuario?.correo ?? correo;
    } else if (correo && !FORMATO_CORREO.test(correo)) {
      return res.status(400).json({ message: "Escribe un correo válido" });
    }

    const abiertas = await Queja.countDocuments({
      autorId: autor.id,
      estado: { $ne: "atendida" },
    });
    if (abiertas >= 5) {
      return res.status(429).json({
        message: "Ya tienes varias quejas en revisión. Espera la respuesta.",
      });
    }

    await Queja.create({
      autorTipo: autor.tipo,
      autorId: autor.id,
      nombre,
      correo,
      asunto: asunto as (typeof ASUNTOS_QUEJA)[number],
      mensaje,
      referencia,
    });

    res.status(201).json({
      message: "Recibimos tu queja. La administración la revisará.",
    });
  } catch (error) {
    console.error("[quejas] Error al registrar la queja:", error);
    res.status(500).json({ message: "No se pudo enviar tu queja" });
  }
});

export default router;
