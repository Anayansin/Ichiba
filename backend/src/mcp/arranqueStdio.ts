import dotenv from "dotenv";
// quiet: sin mensajes promocionales de dotenv; stdout queda reservado para el
// protocolo MCP (los avisos del arranque van por stderr).
dotenv.config({ quiet: true });

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { coneccionDB } from "../configuracion/db.js";
import { NOMBRE_SERVIDOR_MCP, VERSION_SERVIDOR_MCP, crearServidorMcp } from "./servidorMcp.js";

/**
 * Fase 5 — Arranque del servidor MCP por stdio.
 *
 * Es el modo que usan los asistentes locales (Claude Desktop, Cursor, VS Code,
 * etc.): el cliente lanza este proceso y habla JSON-RPC por la entrada y la
 * salida estándar. Conecta a las mismas bases que el backend (PostgreSQL y
 * MongoDB) para que las herramientas trabajen sobre los datos reales.
 *
 * Uso:
 *   npm run mcp
 */
async function main() {
  await coneccionDB();

  const servidor = crearServidorMcp();
  const transporte = new StdioServerTransport();
  await servidor.connect(transporte);

  // stderr (no stdout): stdout es el canal del protocolo MCP.
  console.error(
    `[mcp] Servidor MCP ${NOMBRE_SERVIDOR_MCP} v${VERSION_SERVIDOR_MCP} escuchando por stdio`,
  );
}

main().catch((error) => {
  console.error("[mcp] No se pudo arrancar el servidor MCP:", error);
  process.exit(1);
});
