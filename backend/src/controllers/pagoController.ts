import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { Producto } from "../models/producto.js";
import { Usuario } from "../models/usuario.js";
import { Cola } from "../models/Cola.js";
import { Venta } from "../models/Venta.js";
import {
  crearOrdenPaypal,
  capturarOrdenPaypal,
} from "../services/paypalService.js";
import { RequestConComprador } from "../middleware/comprador.js";
import {
  iniciarTemporizadorPago,
  expirarTurnoSiVencido,
} from "../services/filaService.js";
import clientePrisma from "../configuracion/prisma.js";

async function buscarProducto(productoId: unknown) {
  if (typeof productoId !== "string" || !/^[0-9a-fA-F]{24}$/.test(productoId))
    return null;
  return Producto.findById(productoId);
}

async function buscarVendedorDeProducto(vendedorId: unknown) {
  const idNumerico = Number(vendedorId);
  if (!Number.isInteger(idNumerico)) return null;
  return clientePrisma.usuario.findUnique({ where: { id: idNumerico } });
}

type IdentidadQueCalifica = { tipo: "usuario" | "comprador"; id: string };

function identificarQuienCalifica(req: Request): IdentidadQueCalifica | null {
  const cabeceraAutorizacion = req.headers.authorization;

  if (cabeceraAutorizacion) {
    try {
      const payload = jwt.verify(
        cabeceraAutorizacion.split(" ")[1],
        process.env.JWT_SECRET as string,
      ) as { id: string };
      return { tipo: "usuario", id: String(payload.id) };
    } catch {
      return null;
    }
  }

  const compradorIdCabecera = req.headers["x-comprador-id"];
  if (typeof compradorIdCabecera === "string" && compradorIdCabecera !== "") {
    return { tipo: "comprador", id: compradorIdCabecera };
  }

  return null;
}

export async function crearOrden(req: RequestConComprador, res: Response) {
  try {
    const { productoId } = req.body;
    const compradorId = req.compradorId as string;

    const miFila = await clientePrisma.cola.findFirst({
      where: {
        productoId,
        compradorId,
        estado: "activa",
      },
    });

    if (!miFila || miFila.posicion !== 1) {
      return res
        .status(403)
        .json({ message: "No es tu turno para pagar todavía" });
    }

    if (!miFila.pagoExpiraEn) {
      await iniciarTemporizadorPago(miFila);
      await clientePrisma.cola.update({
        where: { id: miFila.id },
        data: { pagoExpiraEn: miFila.pagoExpiraEn },
      });
    } else if (await expirarTurnoSiVencido(miFila)) {
      return res.status(403).json({
        message: "Se agotó tu tiempo para pagar y perdiste tu turno en la fila",
      });
    }

    const producto = await buscarProducto(productoId);
    if (!producto)
      return res.status(404).json({ message: "Producto no encontrado" });

    const vendedor = await buscarVendedorDeProducto(producto.vendedorId);
    if (!vendedor)
      return res.status(404).json({ message: "Vendedor no encontrado" });

    const orden = await crearOrdenPaypal(
      producto.precio,
      vendedor.paypalEmail,
      productoId,
    );

    const linkAprobacion = orden.links.find(
      (l: any) => l.rel === "approve",
    )?.href;

    res.json({ orderId: orden.id, linkAprobacion });
  } catch (error) {
    console.error("Error real:", error);
    res.status(500).json({ message: "Error al crear la orden de pago" });
  }
}

export async function capturarOrden(req: RequestConComprador, res: Response) {
  try {
    const orderId = req.params.orderId as string;
    const compradorId = req.compradorId as string;

    const resultado = await capturarOrdenPaypal(orderId);

    if (resultado.status !== "COMPLETED") {
      return res
        .status(400)
        .json({ message: "El pago no se completó correctamente" });
    }

    const productoId = resultado.purchase_units[0].reference_id;
    const monto = Number(
      resultado.purchase_units[0].payments.captures[0].amount.value,
    );

    const producto = await buscarProducto(productoId);
    if (!producto)
      return res.status(404).json({ message: "Producto no encontrado" });

    const vendedorId = Number(producto.vendedorId);
    if (!Number.isInteger(vendedorId)) {
      return res.status(404).json({ message: "Vendedor no encontrado" });
    }

    await Producto.updateOne({ _id: productoId }, { activo: false });

    await clientePrisma.cola.updateMany({
      where: { productoId, compradorId, estado: "activa" },
      data: { estado: "pagada" },
    });

    await clientePrisma.cola.updateMany({
      where: { productoId, estado: "activa" },
      data: { estado: "esperando_confirmacion" },
    });

    await clientePrisma.usuario.update({
      where: { id: vendedorId },
      data: { ventasExitosas: { increment: 1 } },
    });

    await clientePrisma.venta.create({
      data: {
        productoId,
        vendedorId,
        compradorId,
        monto,
        paypalOrderId: orderId,
      },
    });

    res.json({
      message: "Pago completado",
      vendedorId,
      productoId,
    });
  } catch (error) {
    console.error("Error real:", error);
    res.status(500).json({ message: "Error al capturar el pago" });
  }
}

export async function calificar(req: Request, res: Response) {
  try {
    const ventaId = req.params.ventaId as string;
    const cuerpo = req.body ?? {};
    const quienCalifica = cuerpo.quienCalifica;
    const puntuacion = cuerpo.puntuacion ?? cuerpo.calificacion;

    if (quienCalifica !== "comprador" && quienCalifica !== "vendedor") {
      return res
        .status(400)
        .json({ message: "Indica quién califica: comprador o vendedor" });
    }

    if (!Number.isInteger(puntuacion) || puntuacion < 1 || puntuacion > 5) {
      return res
        .status(400)
        .json({ message: "La calificación debe ser un número de 1 a 5" });
    }

    if (!/^[0-9a-fA-F]{24}$/.test(ventaId)) {
      return res.status(404).json({ message: "Compra no encontrada" });
    }

    const venta = await Venta.findById(ventaId);
    if (!venta) {
      return res.status(404).json({ message: "Compra no encontrada" });
    }

    const personaQueCalifica = identificarQuienCalifica(req);
    if (!personaQueCalifica) {
      return res
        .status(401)
        .json({ message: "Identifícate para calificar esta compra" });
    }

    const esElCompradorDeLaVenta =
      quienCalifica === "comprador" &&
      personaQueCalifica.tipo === "comprador" &&
      personaQueCalifica.id === venta.compradorId;

    const esElVendedorDeLaVenta =
      quienCalifica === "vendedor" &&
      personaQueCalifica.tipo === "usuario" &&
      personaQueCalifica.id === String(venta.vendedorId);

    if (!esElCompradorDeLaVenta && !esElVendedorDeLaVenta) {
      return res
        .status(403)
        .json({ message: "No puedes calificar esta compra" });
    }

    const calificacionActual =
      quienCalifica === "comprador"
        ? venta.calificacionComprador
        : venta.calificacionVendedor;

    if (typeof calificacionActual === "number") {
      return res.status(400).json({ message: "Ya calificaste esta compra" });
    }

    if (quienCalifica === "comprador") {
      venta.calificacionComprador = puntuacion;
    } else {
      venta.calificacionVendedor = puntuacion;
    }

    await venta.save();

    res.json({
      message: "Calificación registrada",
      calificacionComprador: venta.calificacionComprador ?? null,
      calificacionVendedor: venta.calificacionVendedor ?? null,
    });
  } catch (error) {
    console.error("Error real:", error);
    res.status(500).json({ message: "Error al calificar la compra" });
  }
}
