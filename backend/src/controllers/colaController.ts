import { Response } from "express";
import { Cola } from "../models/Cola";
import { RequestConComprador } from "../middleware/comprador.js";

const LIMITE_FILAS_ACTIVAS = 3;

export async function entrarEnFila(req: RequestConComprador, res: Response) {
  try {
    const { productoId } = req.body;
    const compradorId = req.compradorId as string;

    const yaEstaEnEstaFila = await Cola.findOne({
      productoId,
      compradorId,
      estado: "activa",
    });

    if (yaEstaEnEstaFila) {
      return res
        .status(400)
        .json({ message: "Ya estás en la fila de este producto" });
    }

    const filasActivas = await Cola.countDocuments({
      compradorId,
      estado: "activa",
    });

    if (filasActivas >= LIMITE_FILAS_ACTIVAS) {
      return res.status(400).json({
        message: `Solo puedes estar en ${LIMITE_FILAS_ACTIVAS} filas al mismo tiempo`,
      });
    }

    const nuevaCola = new Cola({ productoId, compradorId });
    const guardada = await nuevaCola.save();

    res.status(201).json(guardada);
  } catch (error) {
    console.error("Error real:", error);
    res.status(500).json({ message: "Error al entrar en la fila" });
  }
}

export async function misFilas(req: RequestConComprador, res: Response) {
  try {
    const compradorId = req.compradorId as string;

    const filas = await Cola.find({ compradorId, estado: "activa" }).populate(
      "productoId",
      "nombre imagenes precio",
    );

    res.json(filas);
  } catch (error) {
    console.error("Error real:", error);
    res.status(500).json({ message: "Error al obtener tus filas" });
  }
}

export async function salirDeFila(req: RequestConComprador, res: Response) {
  try {
    const compradorId = req.compradorId as string;

    const fila = await Cola.findOne({ _id: req.params.id, compradorId });

    if (!fila) {
      return res.status(404).json({ message: "Fila no encontrada" });
    }

    fila.estado = "finalizada";
    await fila.save();

    res.json({ message: "Saliste de la fila" });
  } catch (error) {
    console.error("Error real:", error);
    res.status(500).json({ message: "Error al salir de la fila" });
  }
}
