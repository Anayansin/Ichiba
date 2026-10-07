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
import suscripcionRoutes from "./routes/suscripcionRoutes.js";
import { iniciarJobRevisionHorarios } from "./jobs/revisionHorarios.js";
import { iniciarJobRevisionPagos } from "./jobs/revisionPagos.js";
import { iniciarJobNotificacionesCategoria } from "./jobs/notificacionesCategoria.js";
import mensajeRoutes from "./routes/mensajeRoutes.js";
import promocionalRoutes from "./routes/promocionalRoutes.js";
import reporteRoutes from "./routes/reporteRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import notificacionRoutes from "./routes/notificacionRoutes.js";
import { ApolloServer as ServidorApollo } from "@apollo/server";
import { expressMiddleware as middlewareExpressApollo } from "@as-integrations/express5";
import { definicionesEsquema } from "./graphql/esquema.js";
import { resolutoresGraphQL } from "./graphql/resolvers.js";
import { extraerContextoGraphQL } from "./graphql/contexto.js";
import { filtroPalabrasProhibidas } from "./utils/filtroPalabras.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

/**
 * Orígenes permitidos para CORS: los que traiga `FRONTEND_URL` (pueden ser
 * varios, separados por coma). En desarrollo además se acepta cualquier puerto
 * de localhost/127.0.0.1 y la red local, por si se abre el sitio desde otro
 * equipo o desde el móvil. En producción solo entra el frontend configurado.
 */
const orignesPermitidas = (process.env.FRONTEND_URL ?? "http://localhost:5173")
  .split(",")
  .map((origen) => origen.trim().replace(/\/+$/, ""))
  .filter(Boolean);

const esDesarrollo = process.env.NODE_ENV !== "production";

function origenPermitido(origen?: string): boolean {
  if (!origen) return true; // curl, Postman o llamadas servidor-a-servidor

  const limpio = origen.trim().replace(/\/+$/, "");
  if (orignesPermitidas.includes(limpio)) return true;

  let url: URL;
  try {
    url = new URL(limpio);
  } catch {
    return false;
  }

  const esLocal =
    url.hostname === "localhost" ||
    url.hostname === "127.0.0.1" ||
    url.hostname === "[::1]";
  if (esLocal) return true;

  if (!esDesarrollo) return false;

  // Desarrollo desde la red local: 192.168.x.x, 10.x o 172.16-31.x
  return /^((192\.168|10)\.|172\.(1[6-9]|2\d|3[01])\.)/.test(url.hostname);
}

app.use(
  cors({
    origin: (origen, callback) => callback(null, origenPermitido(origen)),
  }),
);
app.use(express.json());
app.use((req, res, next) => {
  res.on("finish", () => {
    if (res.statusCode >= 400) {
      console.log(
        `[respuesta fallida] ${req.method} ${req.originalUrl} -> ${res.statusCode}`,
      );
    }
  });
  next();
});
// Ningún campo manual del proyecto acepta palabras prohibidas
app.use(filtroPalabrasProhibidas);
// Las fotos de INE son documentos personales: solo se usan durante el
// registro (OCR) y viven en disco. Nunca se sirven por HTTP.
app.use("/uploads/ine", (_req, res) => {
  res.status(404).json({ message: "No encontrado" });
});
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

app.use("/api/productos", productoRoutes);
app.use("/api/usuarios", usuarioRoutes);
app.use("/api/verificacion", verificacionRoutes);
app.use("/api/pagos", pagoRoutes);
app.use("/api/colas", colaRoutes);
app.use("/api/mensajes", mensajeRoutes);
app.use("/api/promocionales", promocionalRoutes);
app.use("/api/reportes", reporteRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/notificaciones", notificacionRoutes);
app.use("/api/suscripciones", suscripcionRoutes);

// Los errores de Multer (archivo muy pesado o tipo no permitido) deben
// responder JSON y no el HTML del manejador por defecto de Express.
app.use(
  (
    error: any,
    _req: import("express").Request,
    res: import("express").Response,
    siguiente: import("express").NextFunction,
  ) => {
    if (error?.name === "MulterError") {
      const mensajes: Record<string, string> = {
        LIMIT_FILE_SIZE: "Las imágenes no pueden pesar más de 5 MB",
        LIMIT_UNEXPECTED_FILE: "Solo se aceptan imágenes",
        LIMIT_FILE_COUNT: "Puedes subir máximo 6 imágenes por producto",
      };
      return res.status(400).json({
        message: mensajes[error.code] ?? "No se pudieron procesar las imágenes",
      });
    }
    console.error("[error no manejado]", error);
    if (res.headersSent) return siguiente(error);
    res.status(500).json({ message: "Error interno del servidor" });
  },
);

const servidorApollo = new ServidorApollo({
  typeDefs: definicionesEsquema,
  resolvers: resolutoresGraphQL,
});

await servidorApollo.start();
app.use(
  "/graphql",
  middlewareExpressApollo(servidorApollo, {
    context: async ({ req: solicitud }) => extraerContextoGraphQL(solicitud),
  }),
);

const PORT = process.env.PORT || 5000;

coneccionDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
  });
});

iniciarJobRevisionHorarios();
iniciarJobRevisionPagos();
iniciarJobNotificacionesCategoria();
