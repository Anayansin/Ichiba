import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { coneccionDB } from "./configuracion/db.js";
import productoRoutes from "./routes/productoRoutes.js";
import usuarioRoutes from "./routes/usuarioRoutes.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/productos", productoRoutes);
app.use("/api/usuarios", usuarioRoutes);

const PORT = process.env.PORT || 5000;

coneccionDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
  });
});
