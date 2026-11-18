import multer from "multer";
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
