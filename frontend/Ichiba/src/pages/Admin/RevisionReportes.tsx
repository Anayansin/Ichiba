import { useEffect, useState } from "react";
import axios from "axios";
import {
  fetchReportesPendientes,
  resolverReporte,
  type ReportePendiente,
} from "../../services/adminService";
import "./RevisionReportes.css";

function RevisionReportes() {
  const [reportes, setReportes] = useState<ReportePendiente[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [reporteEnAccion, setReporteEnAccion] = useState<number | null>(null);

  useEffect(() => {
    setCargando(true);
    setError("");
    fetchReportesPendientes()
      .then(setReportes)
      .catch((err) =>
        setError(
          (axios.isAxiosError(err) && err.response?.data?.message) ||
            "No pudimos cargar los reportes pendientes",
        ),
      )
      .finally(() => setCargando(false));
  }, []);

  async function resolver(
    reporte: ReportePendiente,
    resultado: "confirmado" | "rechazado",
  ) {
    setError("");
    setAviso("");
    setReporteEnAccion(reporte.id);

    try {
      const respuesta = await resolverReporte(reporte.id, resultado);

      setReportes((anteriores) =>
        anteriores.filter((item) => item.id !== reporte.id),
      );

      let mensajeAviso = respuesta.message;
      if (respuesta.faltaGraveRegistrada) {
        mensajeAviso +=
          " Se registró una falta grave por reincidencia (múltiplo de 3 faltas leves).";
      } else if (respuesta.faltasLeves !== undefined) {
        mensajeAviso += ` Faltas leves acumuladas: ${respuesta.faltasLeves}.`;
      }
      setAviso(mensajeAviso);
    } catch (err) {
      setError(
        (axios.isAxiosError(err) && err.response?.data?.message) ||
          "No pudimos resolver el reporte",
      );
    } finally {
      setReporteEnAccion(null);
    }
  }

  if (cargando) {
    return (
      <p className="revision-reportes__vacio">Cargando reportes pendientes...</p>
    );
  }

  return (
    <div className="revision-reportes">
      <div className="revision-reportes__cabecera">
        <h2>Reportes pendientes</h2>
        <span>{reportes.length} pendiente(s)</span>
      </div>

      {error && <p className="revision-reportes__error">{error}</p>}
      {aviso && <p className="revision-reportes__aviso">{aviso}</p>}

      {reportes.length === 0 ? (
        <p className="revision-reportes__vacio">
          No hay reportes pendientes por revisar.
        </p>
      ) : (
        <ul className="revision-reportes__lista">
          {reportes.map((reporte) => (
            <li key={reporte.id} className="revision-reportes__item">
              <div className="revision-reportes__titulo">
                <h3>{reporte.categoriaNombre}</h3>
                <span
                  className={`revision-reportes__falta revision-reportes__falta--${reporte.tipoFalta}`}
                >
                  falta {reporte.tipoFalta}
                </span>
              </div>

              <p className="revision-reportes__meta">
                {reporte.sujetoTipo === "usuario" ? "Vendedor" : "Usuario"}:{" "}
                {reporte.vendedorNombre} · Elemento: {reporte.elemento} ·
                Reportado por {reporte.reportadoPorTipo} ·{" "}
                {new Date(reporte.fecha).toLocaleString("es-MX")}
              </p>

              {reporte.detalle && (
                <p className="revision-reportes__detalle">{reporte.detalle}</p>
              )}

              <div className="revision-reportes__acciones">
                <button
                  type="button"
                  className="revision-reportes__confirmar"
                  disabled={reporteEnAccion === reporte.id}
                  onClick={() => resolver(reporte, "confirmado")}
                >
                  Confirmar
                </button>
                <button
                  type="button"
                  className="revision-reportes__rechazar"
                  disabled={reporteEnAccion === reporte.id}
                  onClick={() => resolver(reporte, "rechazado")}
                >
                  Rechazar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default RevisionReportes;
