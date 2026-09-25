import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { Request, Response, NextFunction } from "express";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const carpetaUploads = path.join(__dirname, "../../uploads");

if (!fs.existsSync(carpetaUploads)) {
  fs.mkdirSync(carpetaUploads, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, carpetaUploads);
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
  const tiposPermitidos = /jpeg|jpg|png|webp/;
  const extensionValida = tiposPermitidos.test(
    path.extname(file.originalname).toLowerCase(),
  );
  const tipoValido = tiposPermitidos.test(file.mimetype);

  if (extensionValida && tipoValido) {
    cb(null, true);
  } else {
    cb(new Error("Solo se permiten imágenes (jpg, jpeg, png, webp)"));
  }
}

export const upload = multer({
  storage,
  fileFilter: filtroArchivos,
  limits: { fileSize: 5 * 1024 * 1024 },
});

/**
 * Sube un solo archivo y devuelve los errores de Multer como JSON (400)
 * en vez del manejo de errores por defecto de Express.
 */
export function subirImagenUnica(campo: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    upload.single(campo)(req, res, (error) => {
      if (error) {
        const mensaje =
          error instanceof multer.MulterError
            ? "La imagen no cumple con los requisitos (máximo 5 MB)"
            : error.message || "No se pudo procesar la imagen";
        return res.status(400).json({ message: mensaje });
      }
      next();
    });
  };
}
