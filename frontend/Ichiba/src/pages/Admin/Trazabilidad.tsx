import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  fetchHistorialTransacciones,
  type EntradaHistorial,
} from "../../services/adminService";
import ModalConversacion from "./ModalConversacion";
import "./Trazabilidad.css";

const FILTROS = [
  { id: "todos", etiqueta: "Todos" },
  { id: "fila", etiqueta: "Fila" },
  { id: "venta", etiqueta: "Venta" },
  { id: "reporte", etiqueta: "Reporte" },
] as const;

type TipoFiltro = "todos" | "fila" | "venta" | "reporte";

function Trazabilidad() {
  const [historial, setHistorial] = useState<EntradaHistorial[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<TipoFiltro>("todos");
  const [ventaConversacion, setVentaConversacion] =
    useState<EntradaHistorial | null>(null);

  useEffect(() => {
    setCargando(true);
    setError("");
    fetchHistorialTransacciones()
      .then(setHistorial)
      .catch((err) =>
        setError(
          (axios.isAxiosError(err) && err.response?.data?.message) ||
            "No pudimos cargar el historial de transacciones",
        ),
      )
      .finally(() => setCargando(false));
  }, []);

  const entradasVisibles = useMemo(
    () =>
      filtroTipo === "todos"
        ? historial
        : historial.filter((entrada) => entrada.tipo === filtroTipo),
    [historial, filtroTipo],
  );

  if (cargando) {
    return (
      <p className="trazabilidad__vacio">Cargando historial de transacciones...</p>
    );
  }

  return (
    <div className="trazabilidad">
      <div className="trazabilidad__cabecera">
        <h2>Historial de transacciones</h2>
        <div className="trazabilidad__filtros">
          {FILTROS.map((filtro) => (
            <button
              key={filtro.id}
              type="button"
              className={`trazabilidad__filtro ${
                filtroTipo === filtro.id ? "trazabilidad__filtro--activo" : ""
              }`}
              onClick={() => setFiltroTipo(filtro.id)}
            >
              {filtro.etiqueta}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="trazabilidad__error">{error}</p>}

      {entradasVisibles.length === 0 ? (
        <p className="trazabilidad__vacio">
          No hay movimientos de este tipo en el historial.
        </p>
      ) : (
        <div className="trazabilidad__contenedor">
          <table className="trazabilidad__tabla">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Producto</th>
                <th>Vendedor</th>
                <th>Monto</th>
                <th>Estado</th>
                <th>Detalle</th>
                <th>Conversación</th>
              </tr>
            </thead>
            <tbody>
              {entradasVisibles.map((entrada) => (
                <tr key={`${entrada.tipo}-${entrada.id}`}>
                  <td>{new Date(entrada.fecha).toLocaleString("es-MX")}</td>
                  <td>
                    <span
                      className={`trazabilidad__tipo trazabilidad__tipo--${entrada.tipo}`}
                    >
                      {entrada.tipo}
                    </span>
                  </td>
                  <td>{entrada.productoNombre}</td>
                  <td>{entrada.vendedorNombre}</td>
                  <td className="trazabilidad__monto">
                    {entrada.monto !== null
                      ? `$${entrada.monto.toLocaleString("es-MX")}`
                      : "—"}
                  </td>
                  <td>{entrada.estado}</td>
                  <td>{entrada.detalle}</td>
                  <td>
                    {entrada.tipo === "venta" ? (
                      <button
                        type="button"
                        className="trazabilidad__ver-conversacion"
                        onClick={() => setVentaConversacion(entrada)}
                      >
                        Ver conversación
                      </button>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {ventaConversacion && (
        <ModalConversacion
          titulo={ventaConversacion.productoNombre}
          ventaId={ventaConversacion.id}
          onCerrar={() => setVentaConversacion(null)}
        />
      )}
    </div>
  );
}

export default Trazabilidad;
