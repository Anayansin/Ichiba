import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { Link, Navigate } from "react-router-dom";
import {
  fetchPerfil,
  type PerfilUsuario,
} from "../../services/usuarioServices";
import { fetchMisProductos } from "../../services/productoService";
import type { Producto } from "../../services/productoService";
import "./PanelVendedor.css";

function PanelVendedor() {
  const { usuario } = useAuth();
  const [perfil, setPerfil] = useState<PerfilUsuario | null>(null);
  const [misProductos, setMisProductos] = useState<Producto[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!usuario) return;

    Promise.all([fetchPerfil(), fetchMisProductos()])
      .then(([datosPerfil, productos]) => {
        setPerfil(datosPerfil);
        setMisProductos(productos);
      })
      .catch((error) => console.error("Error al cargar el panel:", error))
      .finally(() => setCargando(false));
  }, [usuario]);

  if (!usuario) {
    return <Navigate to="/" replace />;
  }

  if (cargando || !perfil) {
    return <p className="panel-vendedor__cargando">Cargando tu panel...</p>;
  }

  return (
    <div className="panel-vendedor">
      <h1>Hola, {perfil.nombreCompleto}</h1>
      <p className="panel-vendedor__correo">{perfil.correo}</p>

      <div className="panel-vendedor__stats">
        <div className="panel-vendedor__stat-card">
          <span className="panel-vendedor__stat-numero">
            {misProductos.length}
          </span>
          <span className="panel-vendedor__stat-label">Productos activos</span>
        </div>
        <div className="panel-vendedor__stat-card">
          <span className="panel-vendedor__stat-numero">
            {perfil.ventasExitosas}
          </span>
          <span className="panel-vendedor__stat-label">
            Ventas concluidas sin problemas
          </span>
        </div>
        <div className="panel-vendedor__stat-card panel-vendedor__stat-card--reportes">
          <span className="panel-vendedor__stat-numero">{perfil.reportes}</span>
          <span className="panel-vendedor__stat-label">Reportes recibidos</span>
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
        {misProductos.length === 0 ? (
          <p className="panel-vendedor__sin-productos">
            Todavía no has publicado ningún producto.
          </p>
        ) : (
          <div className="panel-vendedor__lista-productos">
            {misProductos.map((producto) => (
              <Link
                key={producto._id}
                to={`/producto/${producto._id}`}
                className="panel-vendedor__producto-item"
              >
                <img src={producto.imagenes[0]} alt={producto.nombre} />
                <div>
                  <p className="panel-vendedor__producto-nombre">
                    {producto.nombre}
                  </p>
                  <p className="panel-vendedor__producto-precio">
                    ${producto.precio}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default PanelVendedor;
