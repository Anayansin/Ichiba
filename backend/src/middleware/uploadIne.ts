import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const carpetaIne = path.join(__dirname, "../../uploads/ine");

if (!fs.existsSync(carpetaIne)) {
  fs.mkdirSync(carpetaIne, { recursive: true });
}

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
