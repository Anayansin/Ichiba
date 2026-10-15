import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { Usuario } from "../models/usuario.js";
import {
  ErrorBackoffice,
  agregarEntradaListaNegraAdmin,
  cambiarSuspensionUsuarioAdmin,
  historialTransaccionesAdmin,
  listarListaNegraAdmin,
  listarReportesPendientesAdmin,
  listarUsuariosAdmin,
  mensajesDeVentaAdmin,
  obtenerResumenAdmin,
  quitarEntradaListaNegraAdmin,
  resolverReporteAdmin,
} from "../services/backofficeService.js";
import {
  esPeriodoValido,
  generarInformesMensuales,
  listarInformesGlobales,
  periodoAnterior,
  periodoDeFecha,
} from "../services/informesService.js";

/**
 * Fase 5 — Servidor MCP (Model Context Protocol) del BackOffice de Ichiba.
 *
 * Expone las herramientas administrativas de la plataforma (mismo motor que
 * los endpoints REST `/api/admin/*`) a asistentes de IA compatibles con MCP
 * (Claude Desktop, Cursor, VS Code, etc.). Todo lo que puede hacer un
 * administrador desde el BackOffice también lo puede consultar o ejecutar un
 * asistente conectado a este servidor.
 *
 * Transportes:
 *  - stdio: `npm run mcp` (o `node --import tsx src/mcp/arranqueStdio.ts`),
 *    para clientes locales que lanzan el proceso.
 *  - HTTP (Streamable HTTP): montado en `/mcp` del backend, protegido con
 *    token JWT de administrador.
 *
 * Cada herramienta responde con el resultado serializado en JSON dentro de
 * `content[0].text`; los errores de negocio (validaciones, «no encontrado»)
 * se devuelven como resultado de error MCP (`isError: true`) con el mensaje
 * tal cual lo daría la API REST.
 */

export const NOMBRE_SERVIDOR_MCP = "ichiba-backoffice";
export const VERSION_SERVIDOR_MCP = "1.0.0";

type ResultadoHerramienta =
  | { content: { type: "text"; text: string }[] }
  | {
      content: { type: "text"; text: string }[];
      isError: true;
    };

function resultadoJson(datos: unknown): ResultadoHerramienta {
  // `JSON.stringify(undefined)` devuelve `undefined` (no texto): el MCP exige
  // siempre un bloque de texto, así que se normaliza a `null`.
  return {
    content: [
      { type: "text", text: JSON.stringify(datos ?? null, null, 2) },
    ],
  };
}

function resultadoError(mensaje: string): ResultadoHerramienta {
  return {
    content: [{ type: "text", text: `Error: ${mensaje}` }],
    isError: true,
  };
}

/** Ejecuta una acción del backoffice traduciendo errores a respuestas MCP. */
async function ejecutar(
  accion: () => Promise<unknown>,
): Promise<ResultadoHerramienta> {
  try {
    return resultadoJson(await accion());
  } catch (error) {
    if (error instanceof ErrorBackoffice) {
      return resultadoError(error.message);
    }
    console.error("[mcp] Error al ejecutar una herramienta:", error);
    return resultadoError(
      error instanceof Error ? error.message : String(error),
    );
  }
}

/**
 * Las herramientas aceptan tanto el id del espejo de MongoDB (24 caracteres
 * hexadecimales) como el id numérico de PostgreSQL; si llega el numérico se
 * traduce al del espejo, que es el que usan las operaciones del BackOffice.
 */
async function resolverIdEspejoUsuario(id: string): Promise<string> {
  const texto = String(id ?? "").trim();
  if (/^[0-9a-fA-F]{24}$/.test(texto)) return texto;

  if (/^\d+$/.test(texto)) {
    const espejo = await Usuario.findOne({ usuarioId: Number(texto) })
      .select("_id")
      .lean();
    if (espejo) return String(espejo._id);
  }

  return texto;
}

export function crearServidorMcp(): McpServer {
  const servidor = new McpServer(
    {
      name: NOMBRE_SERVIDOR_MCP,
      version: VERSION_SERVIDOR_MCP,
    },
    {
      instructions:
        "Servidor MCP del BackOffice de Ichiba (marketplace). Ofrece al asistente las mismas herramientas del panel de administración: resumen del dashboard, usuarios (suspender y reactivar), reportes y su resolución, lista negra, historial de transacciones, auditoría de chats de una venta e informes globales. Los cambios que hagan estas herramientas se reflejan al instante en el BackOffice y respetan las reglas de negocio de la plataforma.",
    },
  );

  // -------------------------------------------------------------------------
  // Dashboard
  // -------------------------------------------------------------------------
  servidor.registerTool(
    "resumen_backoffice",
    {
      title: "Resumen del BackOffice",
      description:
        "Devuelve el resumen en vivo del dashboard del administrador: totales de usuarios (activos, suspendidos, cancelados, administradores, nuevos en 30 días), catálogo de productos y promocionales, ventas (totales, del mes, por estado y últimas), reportes pendientes, filas activas, mensajes y tamaño de la lista negra.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => ejecutar(() => obtenerResumenAdmin()),
  );

  // -------------------------------------------------------------------------
  // Usuarios (RQF36)
  // -------------------------------------------------------------------------
  servidor.registerTool(
    "listar_usuarios",
    {
      title: "Listar usuarios",
      description:
        "Lista paginada de usuarios registrados (vendedores, compradores y administradores) con su reputación por puntos, estado de suspensión y estado de cuenta. Permite filtrar por nombre o correo.",
      inputSchema: {
        pagina: z
          .number()
          .int()
          .min(1)
          .optional()
          .describe("Número de página (empieza en 1). Por defecto 1."),
        por_pagina: z
          .number()
          .int()
          .min(1)
          .max(50)
          .optional()
          .describe("Usuarios por página (por defecto 10)."),
        busqueda: z
          .string()
          .optional()
          .describe("Texto a buscar en el nombre o el correo del usuario."),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ pagina, por_pagina, busqueda }) =>
      ejecutar(() =>
        listarUsuariosAdmin({
          pagina,
          porPagina: por_pagina,
          busqueda,
        }),
      ),
  );

  servidor.registerTool(
    "suspender_usuario",
    {
      title: "Suspender usuario",
      description:
        "Suspende (bloquea el acceso) a un usuario. Acepta el id del usuario en MongoDB o el id numérico de PostgreSQL. No aplica a cuentas canceladas de forma permanente por acumular 8 puntos.",
      inputSchema: {
        id_usuario: z
          .string()
          .describe("Id del usuario (MongoDB de 24 caracteres o numérico de PostgreSQL)."),
      },
      annotations: { destructiveHint: true },
    },
    async ({ id_usuario }) =>
      ejecutar(async () =>
        cambiarSuspensionUsuarioAdmin(
          await resolverIdEspejoUsuario(id_usuario),
          true,
        ),
      ),
  );

  servidor.registerTool(
    "reactivar_usuario",
    {
      title: "Reactivar usuario",
      description:
        "Reactiva (quita la suspensión) a un usuario. Acepta el id del usuario en MongoDB o el id numérico de PostgreSQL. No aplica a cuentas canceladas de forma permanente por acumular 8 puntos.",
      inputSchema: {
        id_usuario: z
          .string()
          .describe("Id del usuario (MongoDB de 24 caracteres o numérico de PostgreSQL)."),
      },
    },
    async ({ id_usuario }) =>
      ejecutar(async () =>
        cambiarSuspensionUsuarioAdmin(
          await resolverIdEspejoUsuario(id_usuario),
          false,
        ),
      ),
  );

  // -------------------------------------------------------------------------
  // Reportes (RQF37)
  // -------------------------------------------------------------------------
  servidor.registerTool(
    "listar_reportes_pendientes",
    {
      title: "Listar reportes pendientes",
      description:
        "Devuelve los reportes (quejas) pendientes de revisión con su categoría, tipo de falta, detalle, puntos que sumaría al confirmarse y los puntos acumulados del vendedor reportado (8 = cancelación permanente).",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => ejecutar(() => listarReportesPendientesAdmin()),
  );

  servidor.registerTool(
    "resolver_reporte",
    {
      title: "Resolver reporte",
      description:
        "Confirma o rechaza un reporte pendiente. Al confirmarlo se suman los puntos de la falta a la reputación del vendedor y, si alcanza 8 puntos, la cuenta se cancela de forma permanente (correo, lista negra y purga).",
      inputSchema: {
        id_reporte: z
          .number()
          .int()
          .describe("Id numérico del reporte (el que aparece en la bandeja del BackOffice)."),
        resultado: z
          .enum(["confirmado", "rechazado"])
          .describe("Resultado de la revisión del reporte."),
      },
      annotations: { destructiveHint: true },
    },
    async ({ id_reporte, resultado }) =>
      ejecutar(() => resolverReporteAdmin(id_reporte, resultado)),
  );

  // -------------------------------------------------------------------------
  // Lista negra (RQNF1.9 / RQNF36)
  // -------------------------------------------------------------------------
  servidor.registerTool(
    "listar_lista_negra",
    {
      title: "Listar lista negra",
      description:
        "Lista paginada de personas vetadas (RFC, CURP, código de la INE, correo y motivo). Los registros impiden un nuevo registro en la plataforma (RQNF1.9 / RQNF36).",
      inputSchema: {
        pagina: z
          .number()
          .int()
          .min(1)
          .optional()
          .describe("Número de página (empieza en 1). Por defecto 1."),
        por_pagina: z
          .number()
          .int()
          .min(1)
          .max(50)
          .optional()
          .describe("Registros por página (por defecto 20)."),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ pagina, por_pagina }) =>
      ejecutar(() =>
        listarListaNegraAdmin({ pagina, porPagina: por_pagina }),
      ),
  );

  servidor.registerTool(
    "agregar_lista_negra",
    {
      title: "Agregar a la lista negra",
      description:
        "Agrega una persona a la lista negra para impedir que vuelva a registrarse. Requiere el motivo y al menos el RFC o la CURP.",
      inputSchema: {
        motivo: z
          .string()
          .min(1)
          .describe("Motivo por el que se veta a la persona (obligatorio)."),
        rfc: z.string().optional().describe("RFC de la persona."),
        curp: z.string().optional().describe("CURP de la persona."),
        ine_codigo_reverso: z
          .string()
          .optional()
          .describe("Código del reverso de la INE (opcional)."),
        correo: z.string().optional().describe("Correo de la persona (opcional)."),
        nombre_completo: z
          .string()
          .optional()
          .describe("Nombre completo de la persona (opcional)."),
      },
      annotations: { destructiveHint: true },
    },
    async ({ motivo, rfc, curp, ine_codigo_reverso, correo, nombre_completo }) =>
      ejecutar(() =>
        agregarEntradaListaNegraAdmin({
          motivo,
          rfc,
          curp,
          ineCodigoReverso: ine_codigo_reverso,
          correo,
          nombreCompleto: nombre_completo,
        }),
      ),
  );

  servidor.registerTool(
    "quitar_lista_negra",
    {
      title: "Quitar de la lista negra",
      description:
        "Elimina una entrada de la lista negra (por ejemplo, si el veto fue un error). Indica el id de la entrada que devuelve `listar_lista_negra`.",
      inputSchema: {
        id_entrada: z
          .string()
          .describe("Id de la entrada de la lista negra (MongoDB de 24 caracteres)."),
      },
      annotations: { destructiveHint: true },
    },
    async ({ id_entrada }) =>
      ejecutar(async () => {
        await quitarEntradaListaNegraAdmin(id_entrada);
        return { message: "Registro eliminado de la lista negra" };
      }),
  );

  // -------------------------------------------------------------------------
  // Historial y auditoría (RQF38 / RQF39)
  // -------------------------------------------------------------------------
  servidor.registerTool(
    "historial_transacciones",
    {
      title: "Historial de transacciones",
      description:
        "Historial reciente (hasta 100 entradas por tipo, del más nuevo al más antiguo) de filas virtuales, ventas y reportes, con producto, vendedor, monto, estado y detalle. Es la vista que usa el administrador para auditar la actividad de la plataforma.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => ejecutar(() => historialTransaccionesAdmin()),
  );

  servidor.registerTool(
    "auditar_chat_venta",
    {
      title: "Auditar chat de una venta",
      description:
        "Devuelve todos los mensajes del chat interno de una venta (comprador y vendedor) en orden cronológico, para auditar un conflicto (RQF39). Indica el id de la venta en MongoDB; puedes obtenerlo de `historial_transacciones`.",
      inputSchema: {
        id_venta: z
          .string()
          .describe("Id de la venta en MongoDB (24 caracteres hexadecimales)."),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ id_venta }) => ejecutar(() => mensajesDeVentaAdmin(id_venta)),
  );

  // -------------------------------------------------------------------------
  // Informes globales (RQF14)
  // -------------------------------------------------------------------------
  servidor.registerTool(
    "listar_informes_globales",
    {
      title: "Listar informes globales",
      description:
        "Historial de informes mensuales globales de la plataforma: categoría más vendida (con desempate por el mes anterior) y tasa de abandono de fila por categoría.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => ejecutar(() => listarInformesGlobales()),
  );

  servidor.registerTool(
    "generar_informes",
    {
      title: "Generar informes de un mes",
      description:
        "Genera (o regenera) los informes mensuales de ventas de todos los vendedores y el informe global de la plataforma para un período YYYY-MM. El sistema los genera solo cada día 1°; esta herramienta sirve para recuperar meses pendientes.",
      inputSchema: {
        periodo: z
          .string()
          .optional()
          .describe(
            "Período en formato YYYY-MM. Si se omite se usa el mes anterior.",
          ),
      },
      annotations: { destructiveHint: true },
    },
    async ({ periodo }) => {
      const solicitado = (periodo ?? "").trim();
      const objetivo =
        solicitado || periodoAnterior(periodoDeFecha(new Date()));

      if (!esPeriodoValido(objetivo)) {
        return resultadoError("El período debe tener el formato YYYY-MM");
      }

      return ejecutar(async () => {
        const resultado = await generarInformesMensuales(objetivo);
        return {
          message: `Informes de ${objetivo} generados`,
          ...resultado,
        };
      });
    },
  );

  return servidor;
}
