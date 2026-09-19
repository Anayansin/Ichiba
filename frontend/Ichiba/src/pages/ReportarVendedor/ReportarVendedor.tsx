import { useState, useEffect } from "react";
import {
  fetchMisVentasComprador,
  type VentaConProducto,
} from "../../services/mensajeService";
import { crearReporte } from "../../services/reporteService";
import "./ReportarVendedor.css";

const MOTIVOS = [
  "El producto no coincide con la descripción",
  "El vendedor no respondió después del pago",
  "Comportamiento irrespetuoso",
  "Sospecha de fraude",
  "Otro",
];

function ReportarVendedor() {
  const [ventas, setVentas] = useState<VentaConProducto[]>([]);
  const [ventaId, setVentaId] = useState("");
  const [motivo, setMotivo] = useState(MOTIVOS[0]);
  const [detalle, setDetalle] = useState("");
  const [enviado, setEnviado] = useState(false);
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

    try {
      // Nota: se requiere vendedorId real; ver comentario abajo del componente.
      await crearReporte(ventaId, motivo, detalle);
      setEnviado(true);
    } catch (err: any) {
      setError(err.response?.data?.message || "Error al enviar el reporte");
    }
  }

  if (enviado) {
    return (
      <div className="reportar">
        <h1>Reporte enviado</h1>
        <p>Nuestro equipo revisará tu reporte a la brevedad.</p>
      </div>
    );
  }

  return (
    <div className="reportar">
      <h1>Reportar un vendedor</h1>
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
          Motivo
          <select value={motivo} onChange={(e) => setMotivo(e.target.value)}>
            {MOTIVOS.map((m) => (
              <option key={m} value={m}>
                {m}
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
          />
        </label>

        <button type="submit" className="reportar__boton">
          Enviar reporte
        </button>
      </form>
    </div>
  );
}

export default ReportarVendedor;
