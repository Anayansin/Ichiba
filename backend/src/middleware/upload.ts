import multer from "multer";
import path from "path";
import { Request, Response, NextFunction } from "express";
import {
  carpetaComprobantes,
  carpetaDisputas,
  carpetaUploads,
} from "../configuracion/almacenamiento.js";
import { persistirArchivosSubidos } from "../configuracion/archivosPersistentes.js";

function continuarTrasGuardar(req: Request, res: Response, next: NextFunction) {
  persistirArchivosSubidos(req, res)
    .then(() => next())
    .catch((error) => next(error));
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

function filtroFotosProducto(
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
    cb(new Error("Solo se permiten imágenes (.jpg, .jpeg o .png)"));
  }
}

const uploadProducto = multer({
  storage,
  fileFilter: filtroFotosProducto,
  limits: { fileSize: 5 * 1024 * 1024 },
});

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
      continuarTrasGuardar(req, res, next);
    });
  };
}

export function subirFotosProducto(campo: string, maximo: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    uploadProducto.array(campo, maximo)(req, res, (error) => {
      if (error) {
        const mensaje =
          error instanceof multer.MulterError
            ? "La imagen no cumple con los requisitos (máximo 5 MB)"
            : error.message || "No se pudo procesar la imagen";
        return res.status(400).json({ message: mensaje });
      }
      continuarTrasGuardar(req, res, next);
    });
  };
}

const storageComprobantes = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, carpetaComprobantes);
  },
  filename: (req, file, cb) => {
    const nombreUnico = `comprobante-${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    cb(null, nombreUnico);
  },
});

const uploadComprobante = multer({
  storage: storageComprobantes,
  fileFilter: filtroFotosProducto,
  limits: { fileSize: 5 * 1024 * 1024 },
});

export function subirComprobante(campo: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    uploadComprobante.single(campo)(req, res, (error) => {
      if (error) {
        const mensaje =
          error instanceof multer.MulterError
            ? "El comprobante no cumple con los requisitos (máximo 5 MB)"
            : error.message || "No se pudo procesar el comprobante";
        return res.status(400).json({ message: mensaje });
      }
      continuarTrasGuardar(req, res, next);
    });
  };
}

const storageDisputas = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, carpetaDisputas);
  },
  filename: (req, file, cb) => {
    const nombreUnico = `disputa-${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    cb(null, nombreUnico);
  },
});

const uploadDisputas = multer({
  storage: storageDisputas,
  fileFilter: filtroArchivos,
  limits: { fileSize: 5 * 1024 * 1024 },
});

export function subirEvidenciasDisputa(campo: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    uploadDisputas.array(campo, 5)(req, res, (error) => {
      if (error) {
        const mensaje =
          error instanceof multer.MulterError
            ? "Las evidencias no cumplen con los requisitos (máximo 5 imágenes de 5 MB cada una)"
            : error.message || "No se pudieron procesar las evidencias";
        return res.status(400).json({ message: mensaje });
      }
      continuarTrasGuardar(req, res, next);
    });
  };
}
