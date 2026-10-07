import { Response } from "express";
import { Producto } from "../models/producto.js";
import { Cola } from "../models/Cola.js";
import { RequestConUsuario } from "../middleware/auth.js";
import { buscarUsuarioPorId } from "../services/usuarioService.js";
import clientePrisma from "../configuracion/prisma.js";
import { Request } from "express";
import path from "path";
import fs from "fs";
import {
  CONDICIONES_PRODUCTO,
  CONDICIONES_USO,
  METODOS_ENTREGA,
  TIEMPO_PAGO_MINIMO,
  TIEMPO_PAGO_MAXIMO,
} from "../models/producto.js";
import {
  campoConPalabrasProhibidas,
  mensajePalabrasProhibidas,
} from "../utils/filtroPalabras.js";
import { categoriaProductoValida } from "../configuracion/categorias.js";
import { validarHorarioEntrega } from "../utils/validarHorario.js";
import { validarDimensionesProducto } from "../services/imagenProductoService.js";

const ESTADOS_FILA_EN_CURSO: ("activa" | "esperando_confirmacion")[] = [
  "activa",
  "esperando_confirmacion",
];

function validarEntrega(req: Request): string | null {
  const { condicion, condicionUso, metodoEntrega, horarioEntregaInicio, horarioEntregaFin, precio, nombre, descripcion } = req.body;

  if (!CONDICIONES_PRODUCTO.includes(condicion)) {
    return "Selecciona la condición del producto";
  }

  if (!CONDICIONES_USO.includes(condicionUso)) {
    return "Selecciona la condición de uso del producto";
  }

  if (!METODOS_ENTREGA.includes(metodoEntrega)) {
    return "Selecciona un método de entrega válido";
  }

  const errorHorarioEntrega = validarHorarioEntrega(horarioEntregaInicio, horarioEntregaFin);
  if (errorHorarioEntrega) {
    return errorHorarioEntrega;
  }

  const tiempoLimitePago = Number(req.body.tiempoLimitePago);
  if (
    !Number.isFinite(tiempoLimitePago) ||
    tiempoLimitePago < TIEMPO_PAGO_MINIMO ||
    tiempoLimitePago > TIEMPO_PAGO_MAXIMO
  ) {
    return "El tiempo límite de pago debe estar entre 30 minutos y 3 horas";
  }

  const precioNumerico = Number(precio);
  if (
    !Number.isFinite(precioNumerico) ||
    precioNumerico < 10 ||
    precioNumerico > 5000
  ) {
    return "El precio debe estar entre $10 y $5,000. Si tu artículo vale más de $5,000, publícalo como promocional en vez de producto.";
  }

  const longitudNombre = nombre?.length ?? 0;
  if (longitudNombre < 10 || longitudNombre > 35) {
    return "El nombre del producto debe tener entre 10 y 35 caracteres";
  }

  const longitudDescripcion = descripcion?.length ?? 0;
  if (longitudDescripcion < 30 || longitudDescripcion > 100) {
    return "La descripción del producto debe tener entre 30 y 100 caracteres";
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

    if (String(producto.vendedorId) !== String(req.usuarioId)) {
      return res
        .status(403)
        .json({ message: "No tienes permiso para editar este producto" });
    }

    const filaEnModeloCola = await Cola.findOne({
      productoId: producto._id,
      estado: { $in: ESTADOS_FILA_EN_CURSO },
    });

    const filaEnPostgres = await clientePrisma.cola.findFirst({
      where: {
        productoId: String(producto._id),
        estado: { in: ESTADOS_FILA_EN_CURSO },
      },
    });

    if (filaEnModeloCola || filaEnPostgres) {
      return res.status(400).json({
        message:
          "No puedes editar ni eliminar un producto con una fila en curso",
      });
    }

    const archivosNuevos = req.files as Express.Multer.File[];
    let imagenesExistentes: string[] = [];
    if (req.body.imagenesExistentes) {
      try {
        const parsed = JSON.parse(req.body.imagenesExistentes);
        if (!Array.isArray(parsed)) throw new Error("no es una lista");
        imagenesExistentes = parsed.filter(
          (imagen): imagen is string => typeof imagen === "string",
        );
      } catch {
        return res.status(400).json({
          message: "La lista de imágenes existentes no es válida",
        });
      }
    }

    for (const archivo of archivosNuevos || []) {
      const dimensionesValidas = await validarDimensionesProducto(archivo.path);
      if (!dimensionesValidas) {
        (archivosNuevos || []).forEach((archivoSubido) => {
          fs.unlink(archivoSubido.path, () => {});
        });
        return res.status(400).json({
          message:
            "Las imágenes del producto deben medir entre 420x540 y 2560x2560 píxeles",
        });
      }
    }

    const categoria = categoriaProductoValida(req.body.categoria);
    if (!categoria) {
      return res.status(400).json({ message: "Selecciona una categoría válida" });
    }

    const imagenesEliminadas = producto.imagenes.filter(
      (img) => !imagenesExistentes.includes(img),
    );

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

    // Solo hasta aquí, que todas las validaciones pasaron, se borran del disco
    // las imágenes que el vendedor quitó del producto.
    imagenesEliminadas.forEach((rutaRelativa) => {
      const rutaCompleta = path.join(process.cwd(), rutaRelativa);
      fs.unlink(rutaCompleta, () => {});
    });

    producto.nombre = req.body.nombre;
    producto.precio = Number(req.body.precio);
    producto.categoria = categoria;
    producto.descripcion = req.body.descripcion;
    producto.condicion = req.body.condicion;
    producto.condicionUso = req.body.condicionUso;
    producto.metodoEntrega = req.body.metodoEntrega;
    producto.horarioEntregaInicio = req.body.horarioEntregaInicio;
    producto.horarioEntregaFin = req.body.horarioEntregaFin;
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
    const usuario = await buscarUsuarioPorId(req.usuarioId);
    if (!usuario) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    const archivos = req.files as Express.Multer.File[];

    if (!archivos || archivos.length === 0) {
      return res
        .status(400)
        .json({ message: "Debes subir al menos una imagen" });
    }

    for (const archivo of archivos) {
      const dimensionesValidas = await validarDimensionesProducto(archivo.path);
      if (!dimensionesValidas) {
        archivos.forEach((archivoSubido) => {
          fs.unlink(archivoSubido.path, () => {});
        });
        return res.status(400).json({
          message:
            "Las imágenes del producto deben medir entre 420x540 y 2560x2560 píxeles",
        });
      }
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

    const categoria = categoriaProductoValida(req.body.categoria);
    if (!categoria) {
      return res.status(400).json({ message: "Selecciona una categoría válida" });
    }

    const nuevoProducto = new Producto({
      nombre: req.body.nombre,
      precio: Number(req.body.precio),
      categoria,
      descripcion: req.body.descripcion,
      condicion: req.body.condicion,
      condicionUso: req.body.condicionUso,
      metodoEntrega: req.body.metodoEntrega,
      horarioEntregaInicio: req.body.horarioEntregaInicio,
      horarioEntregaFin: req.body.horarioEntregaFin,
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
    const productos = await Producto.find(filtroDeCatalogo(req));
    res.json(productos);
  } catch (error) {
    console.error("Error real:", error);
    res.status(500).json({ message: "Error al obtener productos" });
  }
}

/**
 * Variantes de cada vocal/consonante con aporte, para que "cafe" encuentre
 * "café" y "cafe" encuentre "café" sin depender de índices de texto.
 */
const VARIANTES_DE_LETRA: Record<string, string> = {
  a: "[aáàäâ]",
  e: "[eéèëê]",
  i: "[iíìïî]",
  o: "[oóòöô]",
  u: "[uúùüû]",
  n: "[nñ]",
};

/** Arma una expresión regular insensible a mayúsculas y acentos, escapando lo que el usuario escriba. */
function patronDeBusqueda(termino: string): RegExp {
  const cuerpo = Array.from(termino.toLowerCase())
    .map((caracter) => {
      const variante = VARIANTES_DE_LETRA[caracter];
      if (variante) return variante;
      return caracter.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    })
    .join("");
  return new RegExp(cuerpo, "i");
}

function textoDeConsulta(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : "";
}

function numeroDeConsulta(valor: unknown): number | null {
  if (valor === undefined || valor === null || valor === "") return null;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

/**
 * Filtro del catálogo público. Acepta los query params:
 * `q` (texto libre), `categoria` (una de CATEGORIAS_PRODUCTO),
 * `vendedorId`, `precioMin` y `precioMax`.
 */
function filtroDeCatalogo(req: Request) {
  const filtro: Record<string, unknown> = { activo: true };

  const categoria = categoriaProductoValida(req.query.categoria);
  if (categoria) {
    filtro.categoria = categoria;
  }

  const vendedorId = textoDeConsulta(req.query.vendedorId);
  if (vendedorId) {
    filtro.vendedorId = vendedorId;
  }

  const termino = textoDeConsulta(req.query.q);
  if (termino) {
    const patron = patronDeBusqueda(termino);
    filtro.$or = [
      { nombre: patron },
      { descripcion: patron },
      { categoria: patron },
      { vendedor: patron },
    ];
  }

  const rangoDePrecio: Record<string, number> = {};
  const precioMin = numeroDeConsulta(req.query.precioMin);
  const precioMax = numeroDeConsulta(req.query.precioMax);
  if (precioMin !== null) rangoDePrecio.$gte = precioMin;
  if (precioMax !== null) rangoDePrecio.$lte = precioMax;
  if (Object.keys(rangoDePrecio).length > 0) {
    filtro.precio = rangoDePrecio;
  }

  return filtro;
}

export async function cambiarEstadoProducto(
  req: RequestConUsuario,
  res: Response,
) {
  try {
    const producto = await Producto.findById(req.params.id);
    if (!producto)
      return res.status(404).json({ message: "Producto no encontrado" });

    if (String(producto.vendedorId) !== String(req.usuarioId)) {
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

    if (String(producto.vendedorId) !== String(req.usuarioId)) {
      return res
        .status(403)
        .json({ message: "No tienes permiso sobre este producto" });
    }

    const filaEnModeloCola = await Cola.findOne({
      productoId: producto._id,
      estado: { $in: ESTADOS_FILA_EN_CURSO },
    });

    const filaEnPostgres = await clientePrisma.cola.findFirst({
      where: {
        productoId: String(producto._id),
        estado: { in: ESTADOS_FILA_EN_CURSO },
      },
    });

    if (filaEnModeloCola || filaEnPostgres) {
      return res.status(400).json({
        message:
          "No puedes editar ni eliminar un producto con una fila en curso",
      });
    }

    producto.imagenes.forEach((rutaRelativa) => {
      const rutaCompleta = path.join(process.cwd(), rutaRelativa);
      fs.unlink(rutaCompleta, () => {});
    });

    // Las filas dejan de existir junto con el producto: sin esto quedan
    // como "activas" y siguen contando para el límite de 3 del comprador
    await Cola.updateMany(
      {
        productoId: producto._id,
        estado: { $in: ["activa", "esperando_confirmacion"] },
      },
      { estado: "finalizada" },
    );

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
