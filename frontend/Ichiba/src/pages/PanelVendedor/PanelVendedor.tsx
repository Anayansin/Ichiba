import { useAuth } from "../../context/AuthContext";
import { Link, Navigate } from "react-router-dom";
import "./PanelVendedor.css";

function PanelVendedor() {
  const { usuario } = useAuth();

  if (!usuario) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="panel-vendedor">
      <h1>Hola, {usuario.nombreCompleto}</h1>
      <p className="panel-vendedor__correo">{usuario.correo}</p>

      <div className="panel-vendedor__stats">
        <div className="panel-vendedor__stat-card">
          <span className="panel-vendedor__stat-numero">0</span>
          <span className="panel-vendedor__stat-label">Productos activos</span>
        </div>
        <div className="panel-vendedor__stat-card">
          <span className="panel-vendedor__stat-numero">0</span>
          <span className="panel-vendedor__stat-label">Ventas totales</span>
        </div>
        <div className="panel-vendedor__stat-card">
          <span className="panel-vendedor__stat-numero">0</span>
          <span className="panel-vendedor__stat-label">Mensajes sin leer</span>
        </div>
      </div>

      <Link
        to="/panel-vendedor/publicar"
        className="panel-vendedor__boton-publicar"
      >
        + Publicar nuevo producto
      </Link>

      <div className="panel-vendedor__productos">
        <h2>Mis productos en venta</h2>
        <p className="panel-vendedor__sin-productos">
          Todavía no has publicado ningún producto.
        </p>
      </div>
    </div>
  );
}

export default PanelVendedor;
