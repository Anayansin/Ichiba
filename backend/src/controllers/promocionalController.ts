import { Response } from "express";
import { Promocional } from "../models/Promocional.js";
import { RequestConUsuario } from "../middleware/auth.js";
import { buscarUsuarioPorId } from "../services/usuarioService.js";
import { Request } from "express";
import path from "path";
import fs from "fs";
import { CONDICIONES_USO_PROMOCIONAL } from "../models/Promocional.js";
import {
  campoConPalabrasProhibidas,
  mensajePalabrasProhibidas,
} from "../utils/filtroPalabras.js";
import { validarDimensionesProducto } from "../services/imagenProductoService.js";

function validarPromocional(req: Request): string | null {
  const { condicionUso, precio, nombre, descripcion, coberturaEnvio } = req.body;

  if (!CONDICIONES_USO_PROMOCIONAL.includes(condicionUso)) {
    return "Selecciona la condición de uso del promocional";
  }

  const precioNumerico = Number(precio);
  if (!Number.isFinite(precioNumerico) || precioNumerico < 5001) {
    return "El precio del promocional debe ser mayor a $5,000";
  }

  const longitudNombre = nombre?.length ?? 0;
  if (longitudNombre < 10 || longitudNombre > 35) {
    return "El nombre del promocional debe tener entre 10 y 35 caracteres";
  }

  const longitudDescripcion = descripcion?.length ?? 0;
  if (longitudDescripcion < 30 || longitudDescripcion > 100) {
    return "La descripción del promocional debe tener entre 30 y 100 caracteres";
  }

  if (!coberturaEnvio || coberturaEnvio.trim() === "") {
    return "La cobertura de envío es obligatoria";
  }

  return null;
}

export async function crearPromocional(req: RequestConUsuario, res: Response) {
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
        archivos.forEach((archivo) => {
          fs.unlink(archivo.path, () => {});
        });
        return res.status(400).json({
          message:
            "Las imágenes del promocional deben medir entre 420x540 y 2560x2560 píxeles",
        });
      }
    }

    const imagenes = archivos.map((archivo) => `/uploads/${archivo.filename}`);

    const errorPromocional = validarPromocional(req);
    if (errorPromocional) {
      return res.status(400).json({ message: errorPromocional });
    }

    const campoProhibido = campoConPalabrasProhibidas({
      nombre: req.body.nombre,
      descripcion: req.body.descripcion,
      coberturaEnvio: req.body.coberturaEnvio,
    });
    if (campoProhibido) {
      return res
        .status(400)
        .json({ message: mensajePalabrasProhibidas(campoProhibido) });
    }

    const nuevoPromocional = new Promocional({
      nombre: req.body.nombre,
      descripcion: req.body.descripcion,
      condicionUso: req.body.condicionUso,
      imagenes,
      precio: Number(req.body.precio),
      coberturaEnvio: req.body.coberturaEnvio,
      chatHabilitado: req.body.chatHabilitado === "true",
      zonaComentariosHabilitada: req.body.zonaComentariosHabilitada === "true",
      vendedorId: req.usuarioId,
      vendedor: usuario.nombreCompleto,
    });

    const guardado = await nuevoPromocional.save();
    res.status(201).json(guardado);
  } catch (error) {
    console.error("Error real:", error);
    res.status(400).json({ message: "Error al crear promocional" });
  }
}

export async function obtenerPromocionales(req: Request, res: Response) {
  try {
    const promocionales = await Promocional.find({ activo: true });
    res.json(promocionales);
  } catch (error) {
    console.error("Error real:", error);
    res.status(500).json({ message: "Error al obtener promocionales" });
  }
}

export async function obtenerPromocionalPorId(req: Request, res: Response) {
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

export async function obtenerMisPromocionales(
  req: RequestConUsuario,
  res: Response,
) {
  try {
    const promocionales = await Promocional.find({
      vendedorId: String(req.usuarioId),
    });
    res.json(promocionales);
  } catch (error) {
    console.error("Error real:", error);
    res.status(500).json({ message: "Error al obtener tus promocionales" });
  }
}

export async function cambiarEstadoPromocional(
  req: RequestConUsuario,
  res: Response,
) {
  try {
    const promocional = await Promocional.findById(req.params.id);
    if (!promocional) {
      return res.status(404).json({ message: "Promocional no encontrado" });
    }

    if (String(promocional.vendedorId) !== String(req.usuarioId)) {
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

export async function actualizarPromocional(
  req: RequestConUsuario,
  res: Response,
) {
  try {
    const promocional = await Promocional.findById(req.params.id);
    if (!promocional)
      return res.status(404).json({ message: "Promocional no encontrado" });

    if (String(promocional.vendedorId) !== String(req.usuarioId)) {
      return res
        .status(403)
        .json({ message: "No tienes permiso para editar este promocional" });
    }

    const archivosNuevos = req.files as Express.Multer.File[];
    const imagenesExistentes: string[] = req.body.imagenesExistentes
      ? JSON.parse(req.body.imagenesExistentes)
      : [];

    for (const archivo of archivosNuevos || []) {
      const dimensionesValidas = await validarDimensionesProducto(archivo.path);
      if (!dimensionesValidas) {
        (archivosNuevos || []).forEach((archivo) => {
          fs.unlink(archivo.path, () => {});
        });
        return res.status(400).json({
          message:
            "Las imágenes del promocional deben medir entre 420x540 y 2560x2560 píxeles",
        });
      }
    }

    const imagenesEliminadas = promocional.imagenes.filter(
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
        .json({ message: "El promocional debe tener al menos una imagen" });
    }

    const errorPromocional = validarPromocional(req);
    if (errorPromocional) {
      return res.status(400).json({ message: errorPromocional });
    }

    const campoProhibido = campoConPalabrasProhibidas({
      nombre: req.body.nombre,
      descripcion: req.body.descripcion,
      coberturaEnvio: req.body.coberturaEnvio,
    });
    if (campoProhibido) {
      return res
        .status(400)
        .json({ message: mensajePalabrasProhibidas(campoProhibido) });
    }

    promocional.nombre = req.body.nombre;
    promocional.descripcion = req.body.descripcion;
    promocional.condicionUso = req.body.condicionUso;
    promocional.precio = Number(req.body.precio);
    promocional.coberturaEnvio = req.body.coberturaEnvio;
    promocional.chatHabilitado = req.body.chatHabilitado === "true";
    promocional.zonaComentariosHabilitada =
      req.body.zonaComentariosHabilitada === "true";
    promocional.imagenes = imagenesFinal;

    const actualizado = await promocional.save();
    res.json(actualizado);
  } catch (error) {
    console.error("Error real:", error);
    res.status(400).json({ message: "Error al actualizar promocional" });
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

    if (String(promocional.vendedorId) !== String(req.usuarioId)) {
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
