import { Response } from "express";
import { Cola } from "../models/Cola.js";
import { RequestConComprador } from "../middleware/comprador.js";
import {
  reacomodarFila,
  iniciarTemporizadorPago,
  expirarTurnoSiVencido,
} from "../services/filaService.js";

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

    const filasActivasDelComprador = await Cola.countDocuments({
      compradorId,
      estado: "activa",
    });

    if (filasActivasDelComprador >= LIMITE_FILAS_ACTIVAS) {
      return res.status(400).json({
        message: `Solo puedes estar en ${LIMITE_FILAS_ACTIVAS} filas al mismo tiempo`,
      });
    }

    const personasEnEstaFila = await Cola.countDocuments({
      productoId,
      estado: "activa",
    });

    const posicion = personasEnEstaFila + 1;

    const nuevaCola = new Cola({
      productoId,
      compradorId,
      posicion,
    });

    // El tiempo de pago empieza a contar desde la posición 1
    if (posicion === 1) {
      await iniciarTemporizadorPago(nuevaCola);
    }

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

    const filas = await Cola.find({ compradorId, estado: "activa" })
      .populate("productoId", "nombre imagenes precio")
      .sort({ posicion: 1 });

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

    await reacomodarFila(fila.productoId.toString(), fila.posicion);

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

    const miFila = await Cola.findOne({
      productoId,
      compradorId,
      estado: "activa",
    });

    if (!miFila) {
      return res
        .status(404)
        .json({ message: "No estás en la fila de este producto" });
    }

    if (miFila.posicion === 1) {
      // Fila heredada sin temporizador: lo iniciamos ahora
      if (!miFila.pagoExpiraEn) {
        await iniciarTemporizadorPago(miFila);
        await miFila.save();
      } else if (await expirarTurnoSiVencido(miFila)) {
        return res.json({
          posicion: null,
          puedePagar: false,
          colaId: miFila._id,
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
      colaId: miFila._id,
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

    const fila = await Cola.findOne({ _id: req.params.id, compradorId });
    if (!fila) return res.status(404).json({ message: "Fila no encontrada" });

    if (conservarTurno) {
      fila.estado = "activa";
      await fila.save();
      return res.json({ message: "Conservaste tu turno, seguirás en espera" });
    }

    fila.estado = "finalizada";
    await fila.save();
    await reacomodarFila(fila.productoId.toString(), fila.posicion);

    res.json({ message: "Saliste de la fila" });
  } catch (error) {
    console.error("Error real:", error);
    res.status(500).json({ message: "Error al procesar tu respuesta" });
  }
}
