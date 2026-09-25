import { Response, Request } from "express";
import path from "path";
import fs from "fs";
import { Promocional } from "../models/Promocional.js";
import { Usuario } from "../models/usuario.js";
import { RequestConUsuario } from "../middleware/auth.js";
import {
  CATEGORIAS_PROMOCIONAL,
  esCategoriaPromocional,
} from "../configuracion/categorias.js";
import {
  campoConPalabrasProhibidas,
  mensajePalabrasProhibidas,
} from "../utils/filtroPalabras.js";

function imagenesSubidas(req: Request): Express.Multer.File[] {
  return (req.files as Express.Multer.File[] | undefined) || [];
}

/** Borra los archivos subidos cuando el promocional no se va a guardar. */
function descartarImagenes(req: Request) {
  imagenesSubidas(req).forEach((archivo) => fs.unlink(archivo.path, () => {}));
}

function validarDatos(req: Request): string | null {
  const { nombre, categoria, descripcion, precio } = req.body;

  if (typeof nombre !== "string" || !nombre.trim())
    return "Escribe el nombre del promocional";

  if (!esCategoriaPromocional(categoria))
    return "Selecciona un tipo de promocional válido";

  if (typeof descripcion !== "string" || !descripcion.trim())
    return "Escribe una descripción";

  const precioNumero = Number(precio);
  if (!Number.isFinite(precioNumero) || precioNumero < 0)
    return "Indica un precio de referencia válido";

  return null;
}

export async function getPromocionales(req: Request, res: Response) {
  try {
    const categoria = req.query.categoria;

    if (categoria !== undefined && !esCategoriaPromocional(categoria)) {
      return res.status(400).json({ message: "Tipo de promocional no válido" });
    }

    type CategoriaPromocional = (typeof CATEGORIAS_PROMOCIONAL)[number];
    const filtro: { activo: boolean; categoria?: CategoriaPromocional } = {
      activo: true,
    };
    if (typeof categoria === "string")
      filtro.categoria = categoria as CategoriaPromocional;

    const promocionales = await Promocional.find(filtro).sort({
      createdAt: -1,
    });
    res.json(promocionales);
  } catch (error) {
    console.error("Error real:", error);
    res.status(500).json({ message: "Error al obtener los promocionales" });
  }
}

export async function getPromocionalPorId(req: Request, res: Response) {
  try {
    const promocional = await Promocional.findById(req.params.id);
    if (!promocional) {
      return res.status(404).json({ message: "Promocional no encontrado" });
    }
    res.json(promocional);
  } catch (error) {
    console.error("Error real:", error);
    res.status(500).json({ message: "Error al obtener el promocional" });
  }
}

export async function getMisPromocionales(
  req: RequestConUsuario,
  res: Response,
) {
  try {
    const promocionales = await Promocional.find({ vendedorId: req.usuarioId });
    res.json(promocionales);
  } catch (error) {
    console.error("Error real:", error);
    res.status(500).json({ message: "Error al obtener tus promocionales" });
  }
}

export async function crearPromocional(
  req: RequestConUsuario,
  res: Response,
) {
  try {
    const usuario = await Usuario.findById(req.usuarioId);
    if (!usuario) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    if (imagenesSubidas(req).length === 0) {
      descartarImagenes(req);
      return res
        .status(400)
        .json({ message: "Debes subir al menos una imagen" });
    }

    const errorDatos = validarDatos(req);
    if (errorDatos) {
      descartarImagenes(req);
      return res.status(400).json({ message: errorDatos });
    }

    // El filtro global corre antes de que Multer arme el cuerpo multipart
    const campoProhibido = campoConPalabrasProhibidas({
      nombre: req.body.nombre,
      descripcion: req.body.descripcion,
    });
    if (campoProhibido) {
      descartarImagenes(req);
      return res
        .status(400)
        .json({ message: mensajePalabrasProhibidas(campoProhibido) });
    }

    const imagenes = imagenesSubidas(req).map(
      (archivo) => `/uploads/${archivo.filename}`,
    );

    const nuevoPromocional = new Promocional({
      nombre: req.body.nombre.trim(),
      precio: Number(req.body.precio),
      categoria: req.body.categoria,
      descripcion: req.body.descripcion.trim(),
      imagenes,
      vendedorId: req.usuarioId,
      vendedor: usuario.nombreCompleto,
    });

    const saved = await nuevoPromocional.save();
    res.status(201).json(saved);
  } catch (error) {
    console.error("Error real:", error);
    descartarImagenes(req);
    res.status(400).json({ message: "Error al crear el promocional" });
  }
}

export async function cambiarEstadoPromocional(
  req: RequestConUsuario,
  res: Response,
) {
  try {
    const promocional = await Promocional.findById(req.params.id);
    if (!promocional)
      return res.status(404).json({ message: "Promocional no encontrado" });

    if (promocional.vendedorId.toString() !== req.usuarioId) {
      return res
        .status(403)
        .json({ message: "No tienes permiso sobre este promocional" });
    }

    promocional.activo = !promocional.activo;
    await promocional.save();
    res.json(promocional);
  } catch (error) {
    console.error("Error real:", error);
    res
      .status(500)
      .json({ message: "Error al cambiar el estado del promocional" });
  }
}

export async function eliminarPromocional(
  req: RequestConUsuario,
  res: Response,
) {
  try {
    const promocional = await Promocional.findById(req.params.id);
    if (!promocional)
      return res.status(404).json({ message: "Promocional no encontrado" });

    if (promocional.vendedorId.toString() !== req.usuarioId) {
      return res
        .status(403)
        .json({ message: "No tienes permiso sobre este promocional" });
    }

    promocional.imagenes.forEach((rutaRelativa) => {
      const rutaCompleta = path.join(process.cwd(), rutaRelativa);
      fs.unlink(rutaCompleta, () => {});
    });

    await promocional.deleteOne();
    res.json({ message: "Promocional eliminado" });
  } catch (error) {
    console.error("Error real:", error);
    res.status(500).json({ message: "Error al eliminar el promocional" });
  }
}
