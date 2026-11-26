import { useState, useEffect } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  fetchMisVentasVendedor,
  type VentaConProducto,
} from "../../services/mensajeService";
import {
  crearReporteComprador,
  type RespuestaReporte,
} from "../../services/reporteService";
import { CATEGORIAS_REPORTE } from "../../configuracion/categoriasReporte";
import { mensajeDeError } from "../../utils/errores";
import "../ReportarVendedor/ReportarVendedor.css";

const DETALLE_MINIMO = 30;
const DETALLE_MAXIMO = 500;

function ReportarComprador() {
  const { usuario } = useAuth();
  const [parametros] = useSearchParams();
  const [ventas, setVentas] = useState<VentaConProducto[]>([]);
  const [ventaId, setVentaId] = useState(parametros.get("venta") ?? "");
  const [categoria, setCategoria] = useState(CATEGORIAS_REPORTE[0].id);
  const [detalle, setDetalle] = useState("");
  const [resultado, setResultado] = useState<RespuestaReporte | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  const longitud = detalle.trim().length;
  const detalleValido = longitud >= DETALLE_MINIMO && longitud <= DETALLE_MAXIMO;

  useEffect(() => {
    fetchMisVentasVendedor()
      .then(setVentas)
      .catch(() => setVentas([]));
  }, []);

  async function enviarReporte(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!ventas.some((v) => v._id === ventaId)) {
      setError("Selecciona la compra relacionada con tu reporte");
      return;
    }
    if (!detalleValido) {
      setError(`El detalle debe tener entre ${DETALLE_MINIMO} y ${DETALLE_MAXIMO} caracteres`);
      return;
    }

    setEnviando(true);
    try {
      setResultado(
        await crearReporteComprador({
          ventaId,
          categoria,
          detalle: detalle.trim(),
        }),
      );
    } catch (err) {
      setError(mensajeDeError(err) || "Error al enviar el reporte");
    } finally {
      setEnviando(false);
    }
  }

  if (!usuario) return <Navigate to="/" replace />;

  if (resultado) {
    return (
      <div className="reportar">
        <h1>Reporte enviado</h1>
        <p>{resultado.message}</p>
        <p className="reportar__nota">
          Estado:{" "}
          <strong>
            {resultado.estado === "pendiente"
              ? "En revisión por un administrador"
              : "Registrado y aplicado"}
          </strong>
        </p>
      </div>
    );
  }

  return (
    <div className="reportar">
      <h1>Reportar a un cliente</h1>

      <form className="reportar__form" onSubmit={enviarReporte}>
        {error && <p className="reportar__error">{error}</p>}

        <label>
          Compra relacionada
          <select
            value={ventaId}
            onChange={(e) => setVentaId(e.target.value)}
            required
          >
            <option value="">Selecciona una compra</option>
            {ventas.map((venta) => (
              <option key={venta._id} value={venta._id}>
                {venta.productoId.nombre}
              </option>
            ))}
          </select>
        </label>

        <label>
          Categoría
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
          >
            {CATEGORIAS_REPORTE.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.nombre}
              </option>
            ))}
          </select>
        </label>

        <label>
          Detalle
          <textarea
            value={detalle}
            onChange={(e) => setDetalle(e.target.value)}
            rows={4}
            maxLength={DETALLE_MAXIMO}
            placeholder="Describe lo que sucedió (mínimo 30 caracteres)"
          />
          <span className="reportar__nota">
            {longitud}/{DETALLE_MAXIMO}
          </span>
        </label>

        <button
          type="submit"
          className="reportar__boton"
          disabled={enviando || !detalleValido}
        >
          {enviando ? "Enviando..." : "Enviar reporte"}
        </button>
      </form>
    </div>
  );
}

export default ReportarComprador;
