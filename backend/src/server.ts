import dotenv from "dotenv";
// quiet: sin mensajes promocionales de dotenv en los logs (en producción solo
// debe verse lo del proyecto). Si falta el .env el error lo dirá Mongo/Prisma.
dotenv.config({ quiet: true });

import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { coneccionDB } from "./configuracion/db.js";
import {
  carpetaUploads,
  carpetaUploadsPublicos,
} from "./configuracion/almacenamiento.js";
import productoRoutes from "./routes/productoRoutes.js";
import usuarioRoutes from "./routes/usuarioRoutes.js";
import verificacionRoutes from "./routes/verificacionRoutes.js";
import pagoRoutes from "./routes/pagoRoutes.js";
import colaRoutes from "./routes/colaRoutes.js";
import suscripcionRoutes from "./routes/suscripcionRoutes.js";
import { iniciarJobRevisionHorarios } from "./jobs/revisionHorarios.js";
import { iniciarJobRevisionPagos } from "./jobs/revisionPagos.js";
import { iniciarJobNotificacionesCategoria } from "./jobs/notificacionesCategoria.js";
import { iniciarJobRevisionEntregas } from "./jobs/revisionEntregas.js";
import { iniciarJobInformesMensuales } from "./jobs/informesMensuales.js";
import { iniciarJobRevisionSanciones } from "./jobs/revisionSanciones.js";
import mensajeRoutes from "./routes/mensajeRoutes.js";
import promocionalRoutes from "./routes/promocionalRoutes.js";
import reporteRoutes from "./routes/reporteRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import notificacionRoutes from "./routes/notificacionRoutes.js";
import informeRoutes from "./routes/informeRoutes.js";
import { rutasMcp } from "./mcp/rutasMcp.js";
import { ApolloServer as ServidorApollo } from "@apollo/server";
import { expressMiddleware as middlewareExpressApollo } from "@as-integrations/express5";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { definicionesEsquema } from "./graphql/esquema.js";
import { resolutoresGraphQL } from "./graphql/resolvers.js";
import { extraerContextoGraphQL } from "./graphql/contexto.js";
import { iniciarServidorDeSuscripciones } from "./graphql/servidorSuscripciones.js";
import { filtroPalabrasProhibidas } from "./utils/filtroPalabras.js";

const app = express();

/**
 * En Vercel la app se importa como función y puede atender varias peticiones
 * seguidas. Cacheamos la promesa de conexión para no abrir una conexión nueva
 * en cada petición y esperamos a Mongo antes de entrar a las rutas de datos.
 */
let conexionMongo: Promise<void> | null = null;

function asegurarConexionMongo(): Promise<void> {
  if (!conexionMongo) {
    conexionMongo = coneccionDB().catch((error) => {
      conexionMongo = null;
      throw error;
    });
  }
  return conexionMongo;
}

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
// RQF22: las imágenes de comprobantes solo se muestran a las partes de la
// venta mediante el endpoint autenticado de pagos; nunca estáticas.
app.use("/uploads/comprobantes", (_req, res) => {
  res.status(404).json({ message: "No encontrado" });
});
app.use("/uploads", express.static(carpetaUploads));
// Vercel ignora express.static(); esta ruta manual sirve las imágenes nuevas
// (en /tmp) y las fotos de catálogo que viajan con el despliegue.
app.get("/uploads/:archivo", (req, res) => {
  const archivo = path.basename(req.params.archivo);
  const ruta =
    [path.join(carpetaUploads, archivo), path.join(carpetaUploadsPublicos, archivo)]
      .find((candidata) => fs.existsSync(candidata)) ?? null;
  if (!ruta) {
    return res.status(404).json({ message: "No encontrado" });
  }
  res.sendFile(ruta, (error) => {
    if (error && !res.headersSent) {
      res.status(404).json({ message: "No encontrado" });
    }
  });
});

// Healthcheck: le indica a la plataforma que el servicio ya arrancó.
// No consulta bases de datos: solo confirma que el proceso responde.
app.get("/api/salud", (_req, res) => {
  res.json({
    estado: "ok",
    servicio: "ichiba-api",
    fecha: new Date().toISOString(),
  });
});

// A partir de aquí sí se necesita Mongo (productos, usuarios, chats, etc.).
app.use((_req, _res, next) => {
  asegurarConexionMongo()
    .then(() => next())
    .catch((error) => next(error));
});

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
app.use("/api/informes", informeRoutes);

// Fase 5: servidor MCP (Streamable HTTP) para asistentes de IA del BackOffice.
// Solo administradores con token; el modo stdio vive en `src/mcp/arranqueStdio.ts`.
app.use("/mcp", rutasMcp);

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

// Fase 4: el mismo esquema ejecutable alimenta Apollo (HTTP, en `/graphql`) y
// las suscripciones en vivo (WebSocket, en la misma ruta).
const esquemaGraphQL = makeExecutableSchema({
  typeDefs: definicionesEsquema,
  resolvers: resolutoresGraphQL,
});

const servidorApollo = new ServidorApollo({
  schema: esquemaGraphQL,
});

await servidorApollo.start();
app.use(
  "/graphql",
  middlewareExpressApollo(servidorApollo, {
    context: async ({ req: solicitud }) => extraerContextoGraphQL(solicitud),
  }),
);

const PORT = process.env.PORT || 5000;
const enVercel =
  process.env.VERCEL === "1" ||
  Boolean(process.env.VERCEL_ENV) ||
  Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);

// Vercel importa esta app como una función; no debe abrir un puerto ni
// registrar cron/WebSocket propios. Las rutas HTTP sí quedan disponibles en el
// mismo dominio del frontend.
export default app;

if (!enVercel) {
  asegurarConexionMongo()
    .then(() => {
      const servidorHttp = app.listen(PORT, () => {
        console.log(`Servidor corriendo en http://localhost:${PORT}`);
      });

      // Sin este manejador, un EADDRINUSE se reporta como error del WebSocket y
      // el proceso sigue vivo sin escuchar, dejando instancias colgadas que
      // ocupan el puerto en los siguientes arranques.
      servidorHttp.on("error", (error: NodeJS.ErrnoException) => {
        if (error.code === "EADDRINUSE") {
          console.error(
            `El puerto ${PORT} ya está en uso. Cierra la otra instancia del backend y vuelve a intentarlo.`,
          );
        } else {
          console.error("No se pudo iniciar el servidor HTTP:", error);
        }
        process.exit(1);
      });

      iniciarServidorDeSuscripciones(servidorHttp, esquemaGraphQL);
    })
    .catch((error) => {
      console.error("No se pudo iniciar el backend:", error);
      process.exit(1);
    });

  iniciarJobRevisionHorarios();
  iniciarJobRevisionPagos();
  iniciarJobNotificacionesCategoria();
  iniciarJobRevisionEntregas();
  iniciarJobInformesMensuales();
  iniciarJobRevisionSanciones();
}
