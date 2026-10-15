import { Router, type Request, type Response } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { verificarToken } from "../middleware/auth.js";
import { esAdmin } from "../middleware/esAdmin.js";
import { crearServidorMcp } from "./servidorMcp.js";

/**
 * Fase 5 — Transporte HTTP (Streamable HTTP) del servidor MCP.
 *
 * Se monta en `/mcp` del backend. Cada petición POST crea un servidor MCP y un
 * transporte sin sesión (modo stateless): así funciona detrás de cualquier
 * proxy y no guarda estado en memoria. El acceso está restringido a
 * administradores con token JWT, igual que el resto del BackOffice.
 *
 * Ejemplo de conexión (JSON-RPC 2.0):
 *   POST /mcp  (header Authorization: Bearer <token de admin>)
 *   {"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}
 */

export const rutasMcp = Router();

rutasMcp.post(
  "/",
  verificarToken,
  esAdmin,
  async (req: Request, res: Response) => {
    const servidor = crearServidorMcp();
    const transporte = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    res.on("close", () => {
      void transporte.close();
      void servidor.close();
    });

    try {
      await servidor.connect(transporte);
      await transporte.handleRequest(req, res, req.body);
    } catch (error) {
      console.error("[mcp] No se pudo procesar la petición HTTP:", error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: "Error interno del servidor MCP",
          },
          id: null,
        });
      }
    }
  },
);

/**
 * El transporte stateless no ofrece streams SSE de servidor a cliente: las
 * peticiones GET y DELETE del protocolo no se usan.
 */
function metodoNoPermitido(res: Response) {
  res.status(405).json({
    jsonrpc: "2.0",
    error: {
      code: -32000,
      message:
        "Método no permitido: el servidor MCP de Ichiba solo acepta POST en /mcp",
    },
    id: null,
  });
}

rutasMcp.get("/", verificarToken, esAdmin, (_req, res) =>
  metodoNoPermitido(res),
);
rutasMcp.delete("/", verificarToken, esAdmin, (_req, res) =>
  metodoNoPermitido(res),
);
