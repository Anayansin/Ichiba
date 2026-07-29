import dotenv from "dotenv";
// ¡Importante! dotenv.config() debe ir inmediatamente debajo de su import,
// antes de importar la base de datos para que la URI esté disponible a tiempo.
dotenv.config();

import express from "express";
import cors from "cors";
import { coneccionDB } from "./configuracion/db.js";
import productoRoutes from "./routes/productoRoutes.js";

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/productos", productoRoutes);

const PORT = process.env.PORT || 5000;

coneccionDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
  });
});
