import {
  claseEstadoVenta,
  etiquetaEstadoVenta,
} from "../../utils/estadoVenta";
import type { EstadoVenta } from "../../services/pagoService";
import "./EtiquetaEstadoVenta.css";

interface EtiquetaEstadoVentaProps {
  estado: EstadoVenta | string | null | undefined;
  rol: "comprador" | "vendedor";
}

/** Etiqueta de color con el estado del escrow (RQNF4). */
function EtiquetaEstadoVenta({ estado, rol }: EtiquetaEstadoVentaProps) {
  return (
    <span className={`estado-venta ${claseEstadoVenta(estado)}`}>
      {etiquetaEstadoVenta(estado, rol)}
    </span>
  );
}

export default EtiquetaEstadoVenta;
