import { useState, useEffect } from "react";
import axios from "axios";
import {
  fetchMisVentasComprador,
  type VentaConProducto,
} from "../../services/mensajeService";
import { crearReporte } from "../../services/reporteService";
import {
  CATEGORIAS_REPORTE,
  ELEMENTOS_REPORTE,
} from "../../configuracion/categoriasReporte";
import "./ReportarVendedor.css";

function ReportarVendedor() {
  const [ventas, setVentas] = useState<VentaConProducto[]>([]);
  const [ventaId, setVentaId] = useState("");
  const [elemento, setElemento] = useState(ELEMENTOS_REPORTE[0].id);
  const [categoria, setCategoria] = useState(CATEGORIAS_REPORTE[0].id);
  const [detalle, setDetalle] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchMisVentasComprador()
      .then(setVentas)
      .catch(() => setVentas([]));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const venta = ventas.find((v) => v._id === ventaId);
    if (!venta) {
      setError("Selecciona la compra relacionada con tu reporte");
      return;
    }

    setEnviando(true);
    try {
      await crearReporte({
        ventaId,
        elemento,
        categoria,
        detalle: detalle.trim(),
      });
      setEnviado(true);
    } catch (err) {
      setError(
        (axios.isAxiosError(err) && err.response?.data?.message) ||
          "Error al enviar el reporte",
      );
    } finally {
      setEnviando(false);
    }
  }

  if (enviado) {
    return (
      <div className="reportar">
        <h1>Reporte enviado</h1>
        <p>Nuestro equipo revisará tu reporte a la brevedad.</p>
        <p className="reportar__nota">
          Los reportes por reincidencia generan faltas leves o graves y pueden
          bloquear temporal o permanentemente a la otra persona.
        </p>
      </div>
    );
  }

  return (
    <div className="reportar">
      <h1>Reportar un vendedor</h1>
      <p className="reportar__nota">
        El reporte se aplica al vendedor de la compra seleccionada. Las
        categorías marcadas como falta grave pueden provocar bloqueos por
        reincidencia.
      </p>

      <form className="reportar__form" onSubmit={handleSubmit}>
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
          ¿Qué quieres reportar?
          <select
            value={elemento}
            onChange={(e) => setElemento(e.target.value)}
          >
            {ELEMENTOS_REPORTE.map((op) => (
              <option key={op.id} value={op.id}>
                {op.nombre}
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
                {cat.nombre} ({cat.tipoFalta})
              </option>
            ))}
          </select>
        </label>

        <label>
          Detalle (opcional)
          <textarea
            value={detalle}
            onChange={(e) => setDetalle(e.target.value)}
            rows={4}
            maxLength={1000}
            placeholder="Cuéntanos qué sucedió"
          />
        </label>

        <button type="submit" className="reportar__boton" disabled={enviando}>
          {enviando ? "Enviando..." : "Enviar reporte"}
        </button>
      </form>
    </div>
  );
}

export default ReportarVendedor;
