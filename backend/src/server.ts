import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { coneccionDB } from "./configuracion/db.js";
import productoRoutes from "./routes/productoRoutes.js";
import usuarioRoutes from "./routes/usuarioRoutes.js";
import verificacionRoutes from "./routes/verificacionRoutes.js";
import pagoRoutes from "./routes/pagoRoutes.js";
import colaRoutes from "./routes/colaRoutes.js";
import { iniciarJobRevisionHorarios } from "./jobs/revisionHorarios.js";
import { iniciarJobRevisionPagos } from "./jobs/revisionPagos.js";
import mensajeRoutes from "./routes/mensajeRoutes.js";
import reporteRoutes from "./routes/reporteRoutes.js";
import notificacionRoutes from "./routes/notificacionRoutes.js";
import { filtroPalabrasProhibidas } from "./utils/filtroPalabras.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors());
app.use(express.json());
// Ningún campo manual del proyecto acepta palabras prohibidas
app.use(filtroPalabrasProhibidas);
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

app.use("/api/productos", productoRoutes);
app.use("/api/usuarios", usuarioRoutes);
app.use("/api/verificacion", verificacionRoutes);
app.use("/api/pagos", pagoRoutes);
app.use("/api/colas", colaRoutes);
app.use("/api/mensajes", mensajeRoutes);
app.use("/api/reportes", reporteRoutes);
app.use("/api/notificaciones", notificacionRoutes);

const PORT = process.env.PORT || 5000;

coneccionDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
  });
});

iniciarJobRevisionHorarios();
iniciarJobRevisionPagos();
