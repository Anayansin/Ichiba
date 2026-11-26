import dotenv from "dotenv";
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
import {
  ejecutarTareasPendientes,
  tareasPorRevisar,
} from "./jobs/programador.js";
import mensajeRoutes from "./routes/mensajeRoutes.js";
import promocionalRoutes from "./routes/promocionalRoutes.js";
import reporteRoutes from "./routes/reporteRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import adminTotalRoutes from "./routes/adminTotalRoutes.js";
import quejaRoutes from "./routes/quejaRoutes.js";
import notificacionRoutes from "./routes/notificacionRoutes.js";
import informeRoutes from "./routes/informeRoutes.js";
import entregaRoutes from "./routes/entregaRoutes.js";
import { rutasMcp } from "./mcp/rutasMcp.js";
import { ApolloServer as ServidorApollo } from "@apollo/server";
import { expressMiddleware as middlewareExpressApollo } from "@as-integrations/express5";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { definicionesEsquema } from "./graphql/esquema.js";
import { resolutoresGraphQL } from "./graphql/resolvers.js";
import { extraerContextoGraphQL } from "./graphql/contexto.js";
import { iniciarServidorDeSuscripciones } from "./graphql/servidorSuscripciones.js";
import { filtroPalabrasProhibidas } from "./utils/filtroPalabras.js";
import { enviarArchivoGuardado } from "./configuracion/archivosPersistentes.js";
import { bitacoraDeAcciones } from "./services/bitacoraService.js";

const app = express();

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

const orignesPermitidas = (process.env.FRONTEND_URL ?? "http://localhost:5173")
  .split(",")
  .map((origen) => origen.trim().replace(/\/+$/, ""))
  .filter(Boolean);

const esDesarrollo = process.env.NODE_ENV !== "production";

function origenPermitido(origen?: string): boolean {
  if (!origen) return true;

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
app.use(filtroPalabrasProhibidas);
app.use("/uploads/ine", (_req, res) => {
  res.status(404).json({ message: "No encontrado" });
});
app.use("/uploads/comprobantes", (_req, res) => {
  res.status(404).json({ message: "No encontrado" });
});
app.use("/uploads", express.static(carpetaUploads));
app.get("/uploads/:archivo", async (req, res) => {
  const archivo = path.basename(req.params.archivo);
  try {
    const rutas = [
      path.join(carpetaUploads, archivo),
      path.join(carpetaUploadsPublicos, archivo),
    ];
    if (!rutas.some((ruta) => fs.existsSync(ruta))) {
      await asegurarConexionMongo();
    }
    if (!(await enviarArchivoGuardado(res, rutas))) {
      res.status(404).json({ message: "No encontrado" });
    }
  } catch {
    if (!res.headersSent) res.status(404).json({ message: "No encontrado" });
  }
});

app.get("/api/salud", (_req, res) => {
  res.json({
    estado: "ok",
    servicio: "ichiba-api",
    fecha: new Date().toISOString(),
  });
});

app.use((_req, _res, next) => {
  asegurarConexionMongo()
    .then(() => next())
    .catch((error) => next(error));
});

function enSegundoPlano(promesa: Promise<unknown>) {
  const contexto = (
    globalThis as Record<symbol, { get?: () => { waitUntil?: (p: Promise<unknown>) => void } }>
  )[Symbol.for("@vercel/request-context")]?.get?.();
  contexto?.waitUntil?.(promesa.catch(() => {}));
}

app.get("/api/tareas/ejecutar", async (req, res) => {
  const secreto = process.env.CRON_SECRET;
  if (secreto && req.headers.authorization !== `Bearer ${secreto}`) {
    return res.status(401).json({ message: "No autorizado" });
  }
  const ejecutadas = await ejecutarTareasPendientes();
  res.json({ ejecutadas });
});

app.use((_req, _res, next) => {
  if (tareasPorRevisar()) {
    enSegundoPlano(ejecutarTareasPendientes());
  }
  next();
});

app.use(bitacoraDeAcciones);

app.use("/api/productos", productoRoutes);
app.use("/api/usuarios", usuarioRoutes);
app.use("/api/verificacion", verificacionRoutes);
app.use("/api/pagos", pagoRoutes);
app.use("/api/colas", colaRoutes);
app.use("/api/mensajes", mensajeRoutes);
app.use("/api/promocionales", promocionalRoutes);
app.use("/api/reportes", reporteRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/admin", adminTotalRoutes);
app.use("/api/quejas", quejaRoutes);
app.use("/api/notificaciones", notificacionRoutes);
app.use("/api/suscripciones", suscripcionRoutes);
app.use("/api/informes", informeRoutes);
app.use("/api/entregas", entregaRoutes);

app.use("/mcp", rutasMcp);

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

export default app;

if (!enVercel) {
  asegurarConexionMongo()
    .then(() => {
      const servidorHttp = app.listen(PORT, () => {
        console.log(`Servidor corriendo en http://localhost:${PORT}`);
      });

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

  setInterval(() => {
    asegurarConexionMongo()
      .then(() => ejecutarTareasPendientes())
      .catch((error) => console.error("[tareas] Error al revisar tareas:", error));
  }, 60 * 1000);
}
