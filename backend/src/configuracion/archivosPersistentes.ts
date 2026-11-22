import fs from "fs";
import path from "path";
import { Request, Response } from "express";
import { Archivo } from "../models/Archivo.js";
import { enVercel } from "./almacenamiento.js";

function archivosDeLaPeticion(req: Request): Express.Multer.File[] {
  const lista: Express.Multer.File[] = [];
  if (req.file) lista.push(req.file);
  if (Array.isArray(req.files)) lista.push(...req.files);
  else if (req.files) lista.push(...Object.values(req.files).flat());
  return lista;
}

export async function persistirArchivosSubidos(
  req: Request,
  res: Response,
): Promise<void> {
  if (!enVercel) return;
  const archivos = archivosDeLaPeticion(req);
  if (archivos.length === 0) return;

  for (const archivo of archivos) {
    await Archivo.updateOne(
      { nombre: archivo.filename },
      {
        $set: {
          nombre: archivo.filename,
          carpeta: path.basename(path.dirname(archivo.path)),
          tipo: archivo.mimetype,
          datos: fs.readFileSync(archivo.path),
        },
      },
      { upsert: true },
    );
  }

  const nombres = archivos.map((archivo) => archivo.filename);
  res.on("finish", () => {
    if (res.statusCode >= 400) {
      Archivo.deleteMany({ nombre: { $in: nombres } }).catch(() => {});
    }
  });
}

export async function enviarArchivoGuardado(
  res: Response,
  rutas: string[],
): Promise<boolean> {
  const enDisco = rutas.find((ruta) => fs.existsSync(ruta));
  if (enDisco) {
    res.sendFile(enDisco);
    return true;
  }

  const nombre = path.basename(rutas[0] ?? "");
  if (!nombre) return false;
  const archivo = await Archivo.findOne({ nombre });
  if (!archivo) return false;

  res.setHeader("Content-Type", archivo.tipo);
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  res.send(archivo.datos);
  return true;
}
