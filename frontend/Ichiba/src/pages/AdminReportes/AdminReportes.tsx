import { useEffect, useState } from "react";
import axios from "axios";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  confirmarReporte,
  fetchReportes,
  type ReporteAdmin,
} from "../../services/reporteService";
import "../ReportarVendedor/ReportarVendedor.css";
import "./AdminReportes.css";

function AdminReportes() {
  const { usuario } = useAuth();
  const [reportes, setReportes] = useState<ReporteAdmin[]>([]);
  const [filtroEstado, setFiltroEstado] = useState("");
  const [recargar, setRecargar] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [confirmando, setConfirmando] = useState<number | null>(null);

  useEffect(() => {
    setCargando(true);
    setError("");
    fetchReportes(filtroEstado || undefined)
      .then(setReportes)
      .catch((err) =>
        setError(
          (axios.isAxiosError(err) && err.response?.data?.message) ||
            "No pudimos cargar los reportes",
        ),
      )
      .finally(() => setCargando(false));
  }, [filtroEstado, recargar]);

  async function confirmar(id: number) {
    setError("");
    setAviso("");
    setConfirmando(id);

    try {
      const respuesta = await confirmarReporte(id);
      setAviso(
        respuesta.faltaGraveRegistrada
          ? "Falta grave registrada por reincidencia: el vendedor queda bloqueado."
          : `Falta leve confirmada: el vendedor acumula ${respuesta.faltasLeves} falta(s) leve(s).`,
      );
      setRecargar((valor) => valor + 1);
    } catch (err) {
      setError(
        (axios.isAxiosError(err) && err.response?.data?.message) ||
          "No pudimos confirmar el reporte",
      );
    } finally {
      setConfirmando(null);
    }
  }

  if (!usuario || usuario.tipo !== "admin") return <Navigate to="/" replace />;

  return (
    <div className="reportar admin-reporte">
      <h1>Reportes de la plataforma</h1>
      <p className="reportar__nota">
        Revisa cada reporte y confirma los que procedan. Cada confirmación suma
        una falta leve al vendedor; al llegar a tres faltas leves se registra
        una falta grave con su bloqueo.
      </p>

      <label className="admin-reporte__filtro">
        Mostrar
        <select
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value)}
        >
          <option value="">Todos los reportes</option>
          <option value="pendiente">Pendientes</option>
          <option value="confirmado">Confirmados</option>
        </select>
      </label>

      {error && <p className="reportar__error">{error}</p>}
      {aviso && <p className="admin-reporte__aviso">{aviso}</p>}

      {cargando ? (
        <p className="admin-reporte__vacio">Cargando reportes...</p>
      ) : reportes.length === 0 ? (
        <p className="admin-reporte__vacio">
          No hay reportes con este filtro.
        </p>
      ) : (
        <ul className="admin-reporte__lista">
          {reportes.map((reporte) => (
            <li key={reporte.id} className="admin-reporte__tarjeta">
              <div className="admin-reporte__cabecera">
                <h2>{reporte.categoriaNombre}</h2>
                <span
                  className={`admin-reporte__falta admin-reporte__falta--${reporte.tipoFalta}`}
                >
                  falta {reporte.tipoFalta}
                </span>
                <span className="admin-reporte__estado">{reporte.estado}</span>
              </div>

              <p className="admin-reporte__meta">
                Vendedor: {reporte.vendedorNombre} · Reportado por{" "}
                {reporte.reportadoPorTipo} ·{" "}
                {new Date(reporte.createdAt).toLocaleString("es-MX")}
              </p>

              {reporte.detalle && (
                <p className="admin-reporte__detalle">{reporte.detalle}</p>
              )}

              {reporte.estado === "pendiente" &&
                reporte.sujetoTipo === "usuario" && (
                  <button
                    type="button"
                    className="reportar__boton"
                    disabled={confirmando === reporte.id}
                    onClick={() => confirmar(reporte.id)}
                  >
                    {confirmando === reporte.id
                      ? "Confirmando..."
                      : "Confirmar falta"}
                  </button>
                )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default AdminReportes;
