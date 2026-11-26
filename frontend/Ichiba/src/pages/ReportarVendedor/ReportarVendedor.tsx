import { useEffect, useState } from "react";
import {
  fetchMisVentasComprador,
  type VentaConProducto,
} from "../../services/mensajeService";
import {
  fetchMisReportes,
  type MiReporte,
} from "../../services/reporteService";
import { nombreElementoReporte } from "../../configuracion/categoriasReporte";
import BotonReportar from "../../components/BotonReportar/BotonReportar";
import "./ReportarVendedor.css";

const TEXTO_ESTADO: Record<MiReporte["estado"], string> = {
  pendiente: "En revisión",
  confirmado: "Confirmado",
  rechazado: "Rechazado",
};

function ReportarVendedor() {
  const [ventas, setVentas] = useState<VentaConProducto[]>([]);
  const [ventaId, setVentaId] = useState("");
  const [reportes, setReportes] = useState<MiReporte[]>([]);

  useEffect(() => {
    fetchMisVentasComprador()
      .then(setVentas)
      .catch(() => setVentas([]));

    function cargarReportes() {
      fetchMisReportes()
        .then(setReportes)
        .catch(() => setReportes([]));
    }
    cargarReportes();
    const intervalo = setInterval(cargarReportes, 15000);
    return () => clearInterval(intervalo);
  }, []);

  return (
    <div className="reportar">
      <h1>Reportar a los administradores</h1>

      <div className="reportar__form">
        <label>
          Compra relacionada (opcional)
          <select value={ventaId} onChange={(e) => setVentaId(e.target.value)}>
            <option value="">Sin compra relacionada</option>
            {ventas.map((venta) => (
              <option key={venta._id} value={venta._id}>
                {venta.productoId.nombre}
              </option>
            ))}
          </select>
        </label>

        {ventaId ? (
          <BotonReportar
            elementos={["vendedor", "mensaje", "publicacion"]}
            ventaId={ventaId}
            texto="Reportar esta compra"
            className="reportar__boton"
          />
        ) : (
          <p className="reportar__nota">
            Sin compra relacionada, abre la publicación o el perfil del vendedor
            y usa su botón «Reportar».
          </p>
        )}
      </div>

      {reportes.length > 0 && (
        <div className="reportar__historial">
          <h2>Mis reportes</h2>
          <ul>
            {reportes.map((reporte) => (
              <li key={reporte.id}>
                <span>
                  {nombreElementoReporte(reporte.elemento)} ·{" "}
                  {reporte.categoriaNombre}
                </span>
                <span
                  className={`reportar__estado reportar__estado--${reporte.estado}`}
                >
                  {TEXTO_ESTADO[reporte.estado] ?? reporte.estado}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default ReportarVendedor;
