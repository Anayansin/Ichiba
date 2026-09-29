import { Response } from "express";
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
