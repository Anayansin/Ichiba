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
 * RQNF7.2: las fotos de los productos del catálogo aceptan únicamente los
 * formatos .png, .jpeg y .jpg (sin webp).
 */
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

/**
 * Sube las fotos de un producto (RQNF7.2: solo .png, .jpeg y .jpg) y
 * devuelve los errores de Multer (formato no permitido, tamaño, cantidad)
 * como JSON con 400 en vez del manejo de errores por defecto de Express.
 */
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
      next();
    });
  };
}

/**
 * RQF22: comprobantes de pago. Viven en su propia carpeta porque NO se
 * sirven como archivos estáticos: solo las partes de la venta pueden verlos
 * (el backend los sirve con autorización y después de la moderación).
 */
const carpetaComprobantes = path.join(__dirname, "../../uploads/comprobantes");

if (!fs.existsSync(carpetaComprobantes)) {
  fs.mkdirSync(carpetaComprobantes, { recursive: true });
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
  fileFilter: filtroArchivos,
  limits: { fileSize: 5 * 1024 * 1024 },
});

/** Sube la fotografía del comprobante de pago (campo único, máx. 5 MB). */
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
      next();
    });
  };
}

/**
 * RQF40: evidencias de una disputa de reembolso (hasta 5 imágenes: fotos del
 * producto, capturas del chat, comprobantes…). Viven en su propia carpeta
 * porque NO se sirven como archivos estáticos: solo las partes de la disputa
 * y la administración pueden verlas (el backend las sirve con autorización).
 */
const carpetaDisputas = path.join(__dirname, "../../uploads/disputas");

if (!fs.existsSync(carpetaDisputas)) {
  fs.mkdirSync(carpetaDisputas, { recursive: true });
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

/** Sube hasta 5 evidencias de una disputa (RQF40). */
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
      next();
    });
  };
}
