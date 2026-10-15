import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  fetchMisCompras,
  fetchVentasDelVendedor,
  type CompraDelComprador,
  type VentaDelVendedor,
} from "../../services/pagoService";
import EtiquetaEstadoVenta from "../../components/EtiquetaEstadoVenta/EtiquetaEstadoVenta";
import { fechaLimiteTexto } from "../../utils/estadoVenta";
import { URL_BACKEND } from "../../services/api";
import "./MisPedidos.css";

/**
 * Seguimiento del escrow (RQNF4) para ambas partes:
 *  - el comprador ve su palabra clave (RQNF20), su código de entrega
 *    (RQNF24.4), los plazos y los motivos de cancelación/reembolso;
 *  - el vendedor ve el estado de sus ventas y los plazos por cumplir.
 */
function MisPedidos() {
  const { usuario } = useAuth();
  const esVendedor = !!usuario;

  const [compras, setCompras] = useState<CompraDelComprador[]>([]);
  const [ventas, setVentas] = useState<VentaDelVendedor[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    setCargando(true);

    if (esVendedor) {
      fetchVentasDelVendedor()
        .then((data) => setVentas(data.ventas))
        .catch(() => setVentas([]))
        .finally(() => setCargando(false));
    } else {
      fetchMisCompras()
        .then((data) => setCompras(data.compras))
        .catch(() => setCompras([]))
        .finally(() => setCargando(false));
    }
  }, [esVendedor]);

  if (cargando) return <p>Cargando tus pedidos...</p>;

  if (esVendedor) {
    return (
      <div className="mis-pedidos">
        <h1>Ventas realizadas</h1>

        {ventas.length === 0 ? (
          <p className="mis-pedidos__vacio">
            Aún no tienes ventas registradas.
          </p>
        ) : (
          ventas.map((venta) => (
            <div key={venta.ventaId} className="mis-pedidos__item">
              <img
                src={`${URL_BACKEND}${venta.producto?.imagenes[0] ?? ""}`}
                alt={venta.producto?.nombre ?? "Producto"}
              />
              <div className="mis-pedidos__info">
                <p className="mis-pedidos__nombre">
                  {venta.producto?.nombre ?? "Producto"}
                </p>
                {venta.fechas.creada && (
                  <p className="mis-pedidos__fecha">
                    {new Date(venta.fechas.creada).toLocaleDateString()}
                  </p>
                )}
                <p className="mis-pedidos__monto">${venta.monto.toFixed(2)}</p>
                <EtiquetaEstadoVenta estado={venta.estado} rol="vendedor" />
                {venta.fechas.confirmacionLimite &&
                  venta.estado === "pendiente_confirmacion" && (
                    <p className="mis-pedidos__plazo">
                      Revisa el comprobante antes de:{" "}
                      {fechaLimiteTexto(venta.fechas.confirmacionLimite)}
                    </p>
                  )}
                {venta.fechas.entregaLimite &&
                  venta.estado === "en_entrega" && (
                    <p className="mis-pedidos__plazo">
                      Registra la entrega antes de:{" "}
                      {fechaLimiteTexto(venta.fechas.entregaLimite)}
                    </p>
                  )}
                {venta.canceladoMotivo && (
                  <p className="mis-pedidos__motivo">
                    Motivo: {venta.canceladoMotivo}
                  </p>
                )}
              </div>
              <Link to="/panel-vendedor" className="mis-pedidos__chat">
                Gestionar en mi panel
              </Link>
            </div>
          ))
        )}
      </div>
    );
  }

  return (
    <div className="mis-pedidos">
      <h1>Mis pedidos</h1>

      {compras.length === 0 ? (
        <p className="mis-pedidos__vacio">
          Aún no has completado ninguna compra.
        </p>
      ) : (
        compras.map((compra) => (
          <div key={compra.ventaId} className="mis-pedidos__item">
            <img
              src={`${URL_BACKEND}${compra.producto?.imagenes[0] ?? ""}`}
              alt={compra.producto?.nombre ?? "Producto"}
            />
            <div className="mis-pedidos__info">
              <p className="mis-pedidos__nombre">
                {compra.producto?.nombre ?? "Producto"}
              </p>
              {compra.creada && (
                <p className="mis-pedidos__fecha">
                  {new Date(compra.creada).toLocaleDateString()}
                </p>
              )}
              <p className="mis-pedidos__monto">${compra.monto.toFixed(2)}</p>
              <EtiquetaEstadoVenta estado={compra.estado} rol="comprador" />

              {compra.codigoPago && (
                <p className="mis-pedidos__codigo">
                  Palabra clave: <strong>{compra.codigoPago}</strong>
                </p>
              )}

              {compra.estado === "en_entrega" && compra.codigoEntrega && (
                <div className="mis-pedidos__entrega">
                  <p className="mis-pedidos__entrega-titulo">
                    Código de confirmación de entrega
                  </p>
                  <p className="mis-pedidos__entrega-codigo">
                    {compra.codigoEntrega}
                  </p>
                  <p className="mis-pedidos__entrega-nota">
                    Dáselo al vendedor únicamente cuando recibas el producto:
                    con él se libera el dinero retenido.
                  </p>
                </div>
              )}

              {compra.confirmacionLimite &&
                compra.estado === "pendiente_confirmacion" && (
                  <p className="mis-pedidos__plazo">
                    El vendedor revisará tu comprobante antes de:{" "}
                    {fechaLimiteTexto(compra.confirmacionLimite)}
                  </p>
                )}

              {compra.entregaLimite && compra.estado === "en_entrega" && (
                <p className="mis-pedidos__plazo">
                  El vendedor debe entregar antes de:{" "}
                  {fechaLimiteTexto(compra.entregaLimite)}
                </p>
              )}

              {compra.canceladoMotivo && (
                <p className="mis-pedidos__motivo">
                  Motivo: {compra.canceladoMotivo}
                </p>
              )}
            </div>

            <div className="mis-pedidos__acciones">
              {compra.estado === "pendiente_comprobante" && (
                <Link
                  to={`/pago-exitoso?venta=${compra.ventaId}`}
                  className="mis-pedidos__chat"
                >
                  Registrar comprobante
                </Link>
              )}
              {compra.ventaMongoId &&
                (compra.estado === "en_entrega" ||
                  compra.estado === "completada") && (
                  <Link to="/chats" className="mis-pedidos__chat">
                    Ver chat
                  </Link>
                )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

export default MisPedidos;
