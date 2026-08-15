import { Response } from "express";
import { Producto } from "../models/producto.js";
import { Usuario } from "../models/usuario.js";
import { RequestConUsuario } from "../middleware/auth.js";
import { Request } from "express";
import path from "path";
import fs from "fs";

export async function actualizarProducto(
  req: RequestConUsuario,
  res: Response,
) {
  try {
    const producto = await Producto.findById(req.params.id);
    if (!producto)
      return res.status(404).json({ message: "Producto no encontrado" });

    if (producto.vendedorId.toString() !== req.usuarioId) {
      return res
        .status(403)
        .json({ message: "No tienes permiso para editar este producto" });
    }

    const archivosNuevos = req.files as Express.Multer.File[];
    const imagenesExistentes: string[] = req.body.imagenesExistentes
      ? JSON.parse(req.body.imagenesExistentes)
      : [];

    const imagenesEliminadas = producto.imagenes.filter(
      (img) => !imagenesExistentes.includes(img),
    );
    imagenesEliminadas.forEach((rutaRelativa) => {
      const rutaCompleta = path.join(process.cwd(), rutaRelativa);
      fs.unlink(rutaCompleta, () => {});
    });

    const imagenesNuevas = (archivosNuevos || []).map(
      (archivo) => `/uploads/${archivo.filename}`,
    );
    const imagenesFinal = [...imagenesExistentes, ...imagenesNuevas];

    if (imagenesFinal.length === 0) {
      return res
        .status(400)
        .json({ message: "El producto debe tener al menos una imagen" });
    }

    producto.nombre = req.body.nombre;
    producto.precio = Number(req.body.precio);
    producto.categoria = req.body.categoria;
    producto.descripcion = req.body.descripcion;
    producto.datosDeEnvio = req.body.datosDeEnvio;
    producto.imagenes = imagenesFinal;

    const actualizado = await producto.save();
    res.json(actualizado);
  } catch (error) {
    console.error("Error real:", error);
    res.status(400).json({ message: "Error al actualizar producto" });
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

export async function getProductos(req: Request, res: Response) {
  try {
    const productos = await Producto.find({ activo: true });
    res.json(productos);
  } catch (error) {
    console.error("Error real:", error);
    res.status(500).json({ message: "Error al obtener productos" });
  }
}

export async function cambiarEstadoProducto(
  req: RequestConUsuario,
  res: Response,
) {
  try {
    const producto = await Producto.findById(req.params.id);
    if (!producto)
      return res.status(404).json({ message: "Producto no encontrado" });

    if (producto.vendedorId.toString() !== req.usuarioId) {
      return res
        .status(403)
        .json({ message: "No tienes permiso sobre este producto" });
    }

    producto.activo = !producto.activo;
    await producto.save();
    res.json(producto);
  } catch (error) {
    console.error("Error real:", error);
    res
      .status(500)
      .json({ message: "Error al cambiar el estado del producto" });
  }
}

export async function eliminarProducto(req: RequestConUsuario, res: Response) {
  try {
    const producto = await Producto.findById(req.params.id);
    if (!producto)
      return res.status(404).json({ message: "Producto no encontrado" });

    if (producto.vendedorId.toString() !== req.usuarioId) {
      return res
        .status(403)
        .json({ message: "No tienes permiso sobre este producto" });
    }

    producto.imagenes.forEach((rutaRelativa) => {
      const rutaCompleta = path.join(process.cwd(), rutaRelativa);
      fs.unlink(rutaCompleta, () => {});
    });

    await producto.deleteOne();
    res.json({ message: "Producto eliminado" });
  } catch (error) {
    console.error("Error real:", error);
    res.status(500).json({ message: "Error al eliminar el producto" });
  }
}
