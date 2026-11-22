import dotenv from "dotenv";
dotenv.config({ quiet: true });

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { coneccionDB } from "../configuracion/db.js";
import { NOMBRE_SERVIDOR_MCP, VERSION_SERVIDOR_MCP, crearServidorMcp } from "./servidorMcp.js";

async function main() {
  await coneccionDB();

  const servidor = crearServidorMcp();
  const transporte = new StdioServerTransport();
  await servidor.connect(transporte);

  console.error(
    `[mcp] Servidor MCP ${NOMBRE_SERVIDOR_MCP} v${VERSION_SERVIDOR_MCP} escuchando por stdio`,
  );
}

main().catch((error) => {
  console.error("[mcp] No se pudo arrancar el servidor MCP:", error);
  process.exit(1);
});
