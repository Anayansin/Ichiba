import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  fetchMisVentasComprador,
  fetchMisVentasVendedor,
  type VentaConProducto,
} from "../../services/mensajeService";
import { URL_BACKEND } from "../../services/api";
import "./MisPedidos.css";

function MisPedidos() {
  const { usuario } = useAuth();
  const [ventas, setVentas] = useState<VentaConProducto[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const fetchFn = usuario ? fetchMisVentasVendedor : fetchMisVentasComprador;
    fetchFn()
      .then(setVentas)
      .catch(() => setVentas([]))
      .finally(() => setCargando(false));
  }, [usuario]);

  if (cargando) return <p>Cargando tus pedidos...</p>;

  return (
    <div className="mis-pedidos">
      <h1>{usuario ? "Ventas realizadas" : "Mis pedidos"}</h1>

      {ventas.length === 0 ? (
        <p className="mis-pedidos__vacio">
          {usuario
            ? "Aún no tienes ventas registradas."
            : "Aún no has completado ninguna compra."}
        </p>
      ) : (
        ventas.map((venta) => (
          <div key={venta._id} className="mis-pedidos__item">
            <img
              src={`${URL_BACKEND}${venta.productoId.imagenes[0]}`}
              alt={venta.productoId.nombre}
            />
            <div className="mis-pedidos__info">
              <p className="mis-pedidos__nombre">{venta.productoId.nombre}</p>
              <p className="mis-pedidos__fecha">
                {new Date(venta.createdAt).toLocaleDateString()}
              </p>
              <p className="mis-pedidos__monto">${venta.monto.toFixed(2)}</p>
            </div>
            <Link to="/chats" className="mis-pedidos__chat">
              Ver chat
            </Link>
          </div>
        ))
      )}
    </div>
  );
}

export default MisPedidos;
