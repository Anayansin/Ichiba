import { Response } from "express";
import { Producto } from "../models/producto.js";
import { Usuario } from "../models/usuario.js";
import { RequestConUsuario } from "../middleware/auth.js";
import { Request } from "express";

export async function getProductos(req: Request, res: Response) {
  try {
    const productos = await Producto.find();
    res.json(productos);
  } catch (error) {
    console.error("Error real:", error);
    res.status(500).json({ message: "Error al obtener productos" });
  }
}

export async function getProductoPorId(req: Request, res: Response) {
  try {
    const producto = await Producto.findById(req.params.id);
    if (!producto) {
      return res.status(404).json({ message: "Producto no encontrado" });
    }
    res.json(producto);
  } catch (error) {
    console.error("Error real:", error);
    res.status(500).json({ message: "Error al obtener el producto" });
  }
}

export async function getMisProductos(req: RequestConUsuario, res: Response) {
  try {
    const productos = await Producto.find({ vendedorId: req.usuarioId });
    res.json(productos);
  } catch (error) {
    console.error("Error real:", error);
    res.status(500).json({ message: "Error al obtener tus productos" });
  }
}

export async function crearProducto(req: RequestConUsuario, res: Response) {
  try {
    const usuario = await Usuario.findById(req.usuarioId);
    if (!usuario) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    const archivos = req.files as Express.Multer.File[];

    if (!archivos || archivos.length === 0) {
      return res
        .status(400)
        .json({ message: "Debes subir al menos una imagen" });
    }

    const imagenes = archivos.map((archivo) => `/uploads/${archivo.filename}`);

    const nuevoProducto = new Producto({
      nombre: req.body.nombre,
      precio: Number(req.body.precio),
      categoria: req.body.categoria,
      descripcion: req.body.descripcion,
      datosDeEnvio: req.body.datosDeEnvio,
      imagenes,
      vendedorId: req.usuarioId,
      vendedor: usuario.nombreCompleto,
    });

    const saved = await nuevoProducto.save();
    res.status(201).json(saved);
  } catch (error) {
    console.error("Error real:", error);
    res.status(400).json({ message: "Error al crear producto" });
  }
}
