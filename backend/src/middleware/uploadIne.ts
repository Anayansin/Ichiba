import multer from "multer";
import type { Request, Response, NextFunction } from "express";
import path from "path";
import { carpetaIne } from "../configuracion/almacenamiento.js";

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, carpetaIne);
  },
  filename: (req, file, cb) => {
    const nombreUnico = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    cb(null, nombreUnico);
  },
});

function filtroArchivos(
  req: any,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) {
  const tiposPermitidos = /jpeg|jpg|png/;
  const extensionValida = tiposPermitidos.test(
    path.extname(file.originalname).toLowerCase(),
  );
  const tipoValido = tiposPermitidos.test(file.mimetype);

  if (extensionValida && tipoValido) {
    cb(null, true);
  } else {
    cb(new Error("Solo se permiten imágenes JPG, JPEG o PNG"));
  }
}

export const uploadIne = multer({
  storage,
  fileFilter: filtroArchivos,
  limits: { fileSize: 8 * 1024 * 1024 },
});

export function subirImagenesIne(req: Request, res: Response, next: NextFunction) {
  uploadIne.fields([
    { name: "ineFrente", maxCount: 1 },
    { name: "ineReverso", maxCount: 1 },
  ])(req, res, (error) => {
    if (error) {
      const mensaje =
        error instanceof multer.MulterError
          ? "Las imágenes de tu INE deben pesar máximo 8 MB"
          : error.message || "No se pudieron procesar las imágenes de tu INE";
      return res.status(400).json({ message: mensaje });
    }
    next();
  });
}
