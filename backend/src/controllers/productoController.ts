import { Response } from "express";
import { Producto } from "../models/producto.js";
import { Usuario } from "../models/usuario.js";
import { RequestConUsuario } from "../middleware/auth.js";
import { Request } from "express";
import path from "path";
import fs from "fs";
import {
  CONDICIONES_PRODUCTO,
  METODOS_ENTREGA,
  TIEMPO_PAGO_MINIMO,
  TIEMPO_PAGO_MAXIMO,
} from "../models/producto.js";
import {
  campoConPalabrasProhibidas,
  mensajePalabrasProhibidas,
} from "../utils/filtroPalabras.js";

const FORMATO_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

function validarEntrega(req: Request): string | null {
  const { condicion, metodoEntrega, horarioInicio, horarioFin } = req.body;

  if (!CONDICIONES_PRODUCTO.includes(condicion)) {
    return "Selecciona la condición del producto";
  }

  if (!METODOS_ENTREGA.includes(metodoEntrega)) {
    return "Selecciona un método de entrega válido";
  }

  if (
    !FORMATO_HORA.test(horarioInicio) ||
    !FORMATO_HORA.test(horarioFin) ||
    horarioInicio >= horarioFin
  ) {
    return "Selecciona un rango válido de horario de coordinación de entrega";
  }

  const tiempoLimitePago = Number(req.body.tiempoLimitePago);
  if (
    !Number.isFinite(tiempoLimitePago) ||
    tiempoLimitePago < TIEMPO_PAGO_MINIMO ||
    tiempoLimitePago > TIEMPO_PAGO_MAXIMO
  ) {
    return "El tiempo límite de pago debe estar entre 30 minutos y 3 horas";
  }

  return null;
}

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

    const errorEntrega = validarEntrega(req);
    if (errorEntrega) {
      return res.status(400).json({ message: errorEntrega });
    }

    const campoProhibido = campoConPalabrasProhibidas({
      nombre: req.body.nombre,
      descripcion: req.body.descripcion,
      datosDeEnvio: req.body.datosDeEnvio,
    });
    if (campoProhibido) {
      return res
        .status(400)
        .json({ message: mensajePalabrasProhibidas(campoProhibido) });
    }

    producto.nombre = req.body.nombre;
    producto.precio = Number(req.body.precio);
    producto.categoria = req.body.categoria;
    producto.descripcion = req.body.descripcion;
    producto.condicion = req.body.condicion;
    producto.metodoEntrega = req.body.metodoEntrega;
    producto.horarioEntrega = {
      inicio: req.body.horarioInicio,
      fin: req.body.horarioFin,
    };
    producto.tiempoLimitePago = Number(req.body.tiempoLimitePago);
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

    const errorEntrega = validarEntrega(req);
    if (errorEntrega) {
      return res.status(400).json({ message: errorEntrega });
    }

    const campoProhibido = campoConPalabrasProhibidas({
      nombre: req.body.nombre,
      descripcion: req.body.descripcion,
      datosDeEnvio: req.body.datosDeEnvio,
    });
    if (campoProhibido) {
      return res
        .status(400)
        .json({ message: mensajePalabrasProhibidas(campoProhibido) });
    }

    const nuevoProducto = new Producto({
      nombre: req.body.nombre,
      precio: Number(req.body.precio),
      categoria: req.body.categoria,
      descripcion: req.body.descripcion,
      condicion: req.body.condicion,
      metodoEntrega: req.body.metodoEntrega,
      horarioEntrega: {
        inicio: req.body.horarioInicio,
        fin: req.body.horarioFin,
      },
      tiempoLimitePago: Number(req.body.tiempoLimitePago),
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

export async function getCategoriaPopular(req: Request, res: Response) {
  try {
    const resultado = await Producto.aggregate([
      {
        $lookup: {
          from: "colas",
          localField: "_id",
          foreignField: "productoId",
          as: "entradasFila",
        },
      },
      {
        $group: {
          _id: "$categoria",
          totalInteres: { $sum: { $size: "$entradasFila" } },
        },
      },
      { $sort: { totalInteres: -1 } },
      { $limit: 1 },
    ]);

    if (resultado.length === 0) {
      return res.json({ categoria: null, totalInteres: 0 });
    }

    res.json({
      categoria: resultado[0]._id,
      totalInteres: resultado[0].totalInteres,
    });
  } catch (error) {
    console.error("Error real:", error);
    res.status(500).json({ message: "Error al calcular la categoría popular" });
  }
}
