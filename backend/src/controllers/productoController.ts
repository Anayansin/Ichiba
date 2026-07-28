import { Request, Response } from "express";
import { Producto } from "../models/producto.js";

export async function getProductos(req: Request, res: Response) {
  console.log("👉 Entrando a getProductos");
  try {
    const productos = await Producto.find();
    res.json(productos);
  } catch (error) {
    console.error("Error real:", error);
    res.status(500).json({ message: "Error al obtener productos" });
  }
}
export async function crearProducto(req: Request, res: Response) {
  try {
    const newProducto = new Producto(req.body);
    const saved = await newProducto.save();
    res.status(201).json(saved);
  } catch (error) {
    console.error("Error real:", error);
    res.status(400).json({ message: "Error al crear producto" });
  }
}
