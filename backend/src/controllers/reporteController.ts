import { Response } from "express";
import { Usuario } from "../models/usuario.js";
import { RequestConComprador } from "../middleware/comprador.js";
import { Reporte } from "../models/Reporte";

export async function crearReporte(req: RequestConComprador, res: Response) {
  try {
    const { vendedorId, motivo, detalle } = req.body;
    const compradorId = req.compradorId as string;

    const vendedor = await Usuario.findById(vendedorId);
    if (!vendedor)
      return res.status(404).json({ message: "Vendedor no encontrado" });

    const reporte = new Reporte({ vendedorId, compradorId, motivo, detalle });
    await reporte.save();

    await Usuario.findByIdAndUpdate(vendedorId, { $inc: { reportes: 1 } });

    res.status(201).json({ message: "Reporte enviado correctamente" });
  } catch (error) {
    console.error("Error real:", error);
    res.status(500).json({ message: "Error al enviar el reporte" });
  }
}
