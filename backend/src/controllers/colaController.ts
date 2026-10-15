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
  limitarTiempoPago,
  obtenerTiempoLimitePago,
  horariosDelVendedorDeProducto,
  pausarHastaLaApertura,
} from "../services/filaService.js";
import { evaluarAtencionDelVendedor } from "../utils/validarHorario.js";

const LIMITE_FILAS_ACTIVAS = 3;

/** RQNF18: estados que ocupan un lugar en la fila virtual. */
const ESTADOS_EN_FILA = ["activa", "esperando_apertura"];

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

    const producto = await Producto.findById(productoId);
    if (!producto) {
      return res.status(404).json({ message: "Producto no encontrado" });
    }

    // RQNF15: fuera del bloque de atención del vendedor no se puede entrar a
    // la fila (el producto sigue visible); se indica la próxima apertura.
    const horarios = await horariosDelVendedorDeProducto(productoId);
    const evaluacion = evaluarAtencionDelVendedor(
      horarios,
      new Date(),
      limitarTiempoPago(producto.tiempoLimitePago),
    );
    if (!evaluacion.atendiendo) {
      return res.status(400).json({
        message: evaluacion.siguienteApertura
          ? `El vendedor no está en horario de atención. Podrás entrar a la fila en su próxima apertura: ${evaluacion.siguienteApertura}.`
          : "El vendedor no tiene bloques de atención programados por ahora.",
        proximoBloque: evaluacion.siguienteApertura,
      });
    }

    await limpiarFilasHuerfanas(compradorId);

    const yaEstaEnEstaFila = await clientePrisma.cola.findFirst({
      where: {
        productoId,
        compradorId,
        estado: { in: ESTADOS_EN_FILA },
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
        estado: { in: ESTADOS_EN_FILA },
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
        estado: { in: ESTADOS_EN_FILA },
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
      where: { compradorId, estado: { in: ESTADOS_EN_FILA } },
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
      data: { estado: "finalizada", motivoCierre: "salio_voluntariamente" },
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
    const productoId = String(req.params.productoId);

    const producto = await Producto.findById(productoId);
    if (!producto) {
      return res.status(404).json({ message: "Producto no encontrado" });
    }

    // RQNF15 / RQNF16 / RQF18: estado de atención del vendedor para esta fila.
    const horarios = await horariosDelVendedorDeProducto(productoId);
    const evaluacion = evaluarAtencionDelVendedor(
      horarios,
      new Date(),
      limitarTiempoPago(producto.tiempoLimitePago),
    );
    const datosHorario = {
      horarioActivo: evaluacion.atendiendo,
      proximoBloque: evaluacion.siguienteApertura,
      avisoAtencion: evaluacion.avisoAtencion,
    };

    const miFila = await clientePrisma.cola.findFirst({
      where: {
        productoId,
        compradorId,
        estado: { in: ESTADOS_EN_FILA },
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
        esperandoApertura: false,
        puedeElegirEspera: false,
        ...datosHorario,
      });
    }

    // RQF18: el comprador guardó su lugar hasta la próxima apertura.
    if (miFila.estado === "esperando_apertura") {
      return res.json({
        posicion: miFila.posicion,
        puedePagar: false,
        colaId: miFila.id,
        pagoExpiraEn: null,
        expiro: false,
        enFila: true,
        esperandoApertura: true,
        puedeElegirEspera: false,
        ...datosHorario,
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
          enFila: false,
          esperandoApertura: false,
          puedeElegirEspera: false,
          mensaje:
            "Se agotó tu tiempo para pagar y perdiste tu turno en la fila",
          ...datosHorario,
        });
      }
    }

    res.json({
      posicion: miFila.posicion,
      puedePagar: miFila.posicion === 1,
      colaId: miFila.id,
      pagoExpiraEn: miFila.pagoExpiraEn ?? null,
      expiro: false,
      enFila: true,
      esperandoApertura: false,
      // RQF18: solo en su turno puede elegir esperar a la próxima apertura.
      puedeElegirEspera:
        miFila.posicion === 1 && evaluacion.puedeEsperarApertura,
      ...datosHorario,
    });
  } catch (error) {
    console.error("Error real:", error);
    res.status(500).json({ message: "Error al consultar tu posición" });
  }
}

/**
 * RQF18 / RQNF18: el comprador, en su turno, decide esperar a la próxima
 * apertura del vendedor cuando su bloque está por terminar (RQNF16) o no está
 * atendiendo: se guarda su lugar y su reloj de pago queda en pausa.
 */
export async function esperarProximaApertura(
  req: RequestConComprador,
  res: Response,
) {
  try {
    const compradorId = req.compradorId as string;

    const fila = await clientePrisma.cola.findFirst({
      where: { id: Number(req.params.id), compradorId },
    });
    if (!fila) return res.status(404).json({ message: "Fila no encontrada" });

    if (fila.estado !== "activa") {
      return res
        .status(400)
        .json({ message: "Esta fila no está esperando su turno" });
    }

    if (Number(fila.posicion) !== 1) {
      return res.status(400).json({
        message: "Solo puedes esperar la próxima apertura cuando es tu turno",
      });
    }

    const productoId = String(fila.productoId);
    const horarios = await horariosDelVendedorDeProducto(productoId);
    const evaluacion = evaluarAtencionDelVendedor(
      horarios,
      new Date(),
      await obtenerTiempoLimitePago(productoId),
    );

    if (!evaluacion.puedeEsperarApertura) {
      return res.status(400).json({
        message:
          "El vendedor está en horario de atención: paga ahora o abandona la fila.",
      });
    }

    await pausarHastaLaApertura(Number(fila.id));

    res.json({
      message: evaluacion.siguienteApertura
        ? `Guardamos tu lugar. Tu turno se reanudará en la próxima apertura del vendedor (${evaluacion.siguienteApertura}); te avisaremos por correo.`
        : "Guardamos tu lugar hasta la próxima apertura del vendedor.",
      proximoBloque: evaluacion.siguienteApertura,
    });
  } catch (error) {
    console.error("Error real:", error);
    res.status(500).json({ message: "Error al esperar la próxima apertura" });
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
      data: { estado: "finalizada", motivoCierre: "salio_voluntariamente" },
    });
    await reacomodarFila(fila.productoId, fila.posicion);

    res.json({ message: "Saliste de la fila" });
  } catch (error) {
    console.error("Error real:", error);
    res.status(500).json({ message: "Error al procesar tu respuesta" });
  }
}
