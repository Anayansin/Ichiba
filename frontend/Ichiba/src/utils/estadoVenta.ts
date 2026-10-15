import type { EstadoVenta } from "../services/pagoService";

/**
 * Textos del ciclo del escrow (RQNF4) para el comprador y el vendedor.
 */
export function etiquetaEstadoVenta(
  estado: EstadoVenta | string | null | undefined,
  rol: "comprador" | "vendedor",
): string {
  switch (estado) {
    case "pendiente_comprobante":
      return rol === "comprador"
        ? "Pago autorizado — falta tu comprobante"
        : "Esperando el comprobante del comprador";
    case "pendiente_confirmacion":
      return rol === "comprador"
        ? "Comprobante en revisión por el vendedor"
        : "Comprobante por revisar";
    case "en_entrega":
      return "En entrega — chat abierto";
    case "completada":
      return "Completada — dinero liberado";
    case "reembolsada":
      return "Cancelada y reembolsada";
    case "cancelada":
      return "Cancelada";
    default:
      return "En proceso";
  }
}

/** Clase de color para las etiquetas de estado. */
export function claseEstadoVenta(
  estado: EstadoVenta | string | null | undefined,
): string {
  switch (estado) {
    case "en_entrega":
      return "estado-venta--activo";
    case "completada":
      return "estado-venta--completada";
    case "reembolsada":
    case "cancelada":
      return "estado-venta--cancelada";
    default:
      return "estado-venta--pendiente";
  }
}

/** Fecha corta y hora en formato local para plazos y resoluciones. */
export function fechaLimiteTexto(fecha: string | null | undefined): string {
  if (!fecha) return "";
  const fechaObjeto = new Date(fecha);
  if (Number.isNaN(fechaObjeto.getTime())) return "";
  return fechaObjeto.toLocaleString([], {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
