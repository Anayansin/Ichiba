import { Response } from "express";
import { RequestConComprador } from "../middleware/comprador.js";
import clientePrisma from "../configuracion/prisma.js";
import { Producto } from "../models/producto.js";
import { FORMATO_CORREO } from "../models/usuario.js";
import {
  reacomodarFila,
  iniciarTemporizadorPago,
  expirarTurnoSiVencido,
  limpiarFilasHuerfanas,
} from "../services/filaService.js";

const LIMITE_FILAS_ACTIVAS = 3;

async function productosDeFilas(filas: any[]) {
  const ids = [
    ...new Set(
      filas
        .map((fila) => String(fila.productoId))
        .filter((id) => /^[0-9a-fA-F]{24}$/.test(id)),
    ),
  ];
  const productos = ids.length
    ? await Producto.find({ _id: { $in: ids } })
    : [];
  return new Map(productos.map((producto) => [String(producto._id), producto]));
}

export async function entrarEnFila(req: RequestConComprador, res: Response) {
  try {
    const { productoId, correo } = req.body;
    const compradorId = req.compradorId as string;

    const correoLimpio =
      typeof correo === "string" ? correo.trim().toLowerCase() : "";

    if (correoLimpio && !FORMATO_CORREO.test(correoLimpio)) {
      return res.status(400).json({ message: "Escribe un correo válido" });
    }

    await limpiarFilasHuerfanas(compradorId);

    const yaEstaEnEstaFila = await clientePrisma.cola.findFirst({
      where: {
        productoId,
        compradorId,
        estado: "activa",
      },
    });

    if (yaEstaEnEstaFila) {
      return res
        .status(400)
        .json({ message: "Ya estás en la fila de este producto" });
    }

    const filasActivasDelComprador = await clientePrisma.cola.count({
      where: {
        compradorId,
        estado: "activa",
      },
    });

    if (filasActivasDelComprador >= LIMITE_FILAS_ACTIVAS) {
      return res.status(400).json({
        message: `Solo puedes estar en ${LIMITE_FILAS_ACTIVAS} filas al mismo tiempo`,
      });
    }

    const ultimaOcupada = await clientePrisma.cola.findFirst({
      where: {
        productoId,
        estado: "activa",
      },
      orderBy: { posicion: "desc" },
      select: { posicion: true },
    });

    const posicion = (ultimaOcupada?.posicion ?? 0) + 1;

    const nuevaCola = await clientePrisma.cola.create({
      data: {
        productoId,
        compradorId,
        posicion,
        correo: correoLimpio || null,
      },
    });

    if (posicion === 1) {
      await iniciarTemporizadorPago(nuevaCola);
      await clientePrisma.cola.update({
        where: { id: Number(nuevaCola.id) },
        data: { pagoExpiraEn: nuevaCola.pagoExpiraEn },
      });
    }

    res.status(201).json({ ...nuevaCola, _id: String(nuevaCola.id) });
  } catch (error) {
    console.error("Error real:", error);
    res.status(500).json({ message: "Error al entrar en la fila" });
  }
}

export async function misFilas(req: RequestConComprador, res: Response) {
  try {
    const compradorId = req.compradorId as string;

    await limpiarFilasHuerfanas(compradorId);

    const filas = await clientePrisma.cola.findMany({
      where: { compradorId, estado: "activa" },
      orderBy: { posicion: "asc" },
    });

    const productos = await productosDeFilas(filas);

    res.json(
      filas.map((fila) => ({
        ...fila,
        _id: String(fila.id),
        productoId: productos.get(String(fila.productoId)) ?? null,
      })),
    );
  } catch (error) {
    console.error("Error real:", error);
    res.status(500).json({ message: "Error al obtener tus filas" });
  }
}

export async function salirDeFila(req: RequestConComprador, res: Response) {
  try {
    const compradorId = req.compradorId as string;

    const fila = await clientePrisma.cola.findFirst({
      where: { id: Number(req.params.id), compradorId },
    });

    if (!fila) {
      return res.status(404).json({ message: "Fila no encontrada" });
    }

    await clientePrisma.cola.update({
      where: { id: fila.id },
      data: { estado: "finalizada" },
    });

    await reacomodarFila(fila.productoId, fila.posicion);

    res.json({ message: "Saliste de la fila" });
  } catch (error) {
    console.error("Error real:", error);
    res.status(500).json({ message: "Error al salir de la fila" });
  }
}

export async function estadoDeMiFila(req: RequestConComprador, res: Response) {
  try {
    const compradorId = req.compradorId as string;
    const { productoId } = req.params;

    const miFila = await clientePrisma.cola.findFirst({
      where: {
        productoId,
        compradorId,
        estado: "activa",
      },
    });

    if (!miFila) {
      return res.json({
        posicion: null,
        puedePagar: false,
        colaId: null,
        pagoExpiraEn: null,
        expiro: false,
        enFila: false,
      });
    }

    if (miFila.posicion === 1) {
      if (!miFila.pagoExpiraEn) {
        await iniciarTemporizadorPago(miFila);
        await clientePrisma.cola.update({
          where: { id: miFila.id },
          data: { pagoExpiraEn: miFila.pagoExpiraEn },
        });
      } else if (await expirarTurnoSiVencido(miFila)) {
        return res.json({
          posicion: null,
          puedePagar: false,
          colaId: miFila.id,
          pagoExpiraEn: null,
          expiro: true,
          mensaje:
            "Se agotó tu tiempo para pagar y perdiste tu turno en la fila",
        });
      }
    }

    res.json({
      posicion: miFila.posicion,
      puedePagar: miFila.posicion === 1,
      colaId: miFila.id,
      pagoExpiraEn: miFila.pagoExpiraEn ?? null,
      expiro: false,
    });
  } catch (error) {
    console.error("Error real:", error);
    res.status(500).json({ message: "Error al consultar tu posición" });
  }
}

export async function responderEsperaConfirmacion(
  req: RequestConComprador,
  res: Response,
) {
  try {
    const compradorId = req.compradorId as string;
    const { conservarTurno } = req.body;

    const fila = await clientePrisma.cola.findFirst({
      where: { id: Number(req.params.id), compradorId },
    });
    if (!fila) return res.status(404).json({ message: "Fila no encontrada" });

    if (conservarTurno) {
      await clientePrisma.cola.update({
        where: { id: fila.id },
        data: { estado: "activa" },
      });
      return res.json({ message: "Conservaste tu turno, seguirás en espera" });
    }

    await clientePrisma.cola.update({
      where: { id: fila.id },
      data: { estado: "finalizada" },
    });
    await reacomodarFila(fila.productoId, fila.posicion);

    res.json({ message: "Saliste de la fila" });
  } catch (error) {
    console.error("Error real:", error);
    res.status(500).json({ message: "Error al procesar tu respuesta" });
  }
}
