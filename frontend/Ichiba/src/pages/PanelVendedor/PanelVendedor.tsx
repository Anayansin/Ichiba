import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { Link, Navigate } from "react-router-dom";
import VerificacionModal from "../../components/VerificacionModal/VerificacionModal";
import {
  fetchPerfil,
  type PerfilUsuario,
} from "../../services/usuarioServices";
import {
  fetchMisProductos,
  cambiarEstadoProducto,
  eliminarProducto,
  type Producto,
} from "../../services/productoService";
import { URL_BACKEND } from "../../services/api";
import "./PanelVendedor.css";

function PanelVendedor() {
  const { usuario } = useAuth();
  const [perfil, setPerfil] = useState<PerfilUsuario | null>(null);
  const [misProductos, setMisProductos] = useState<Producto[]>([]);
  const [cargando, setCargando] = useState(true);

  function cargarDatos() {
    Promise.all([fetchPerfil(), fetchMisProductos()])
      .then(([datosPerfil, productos]) => {
        setPerfil(datosPerfil);
        setMisProductos(productos);
      })
      .catch((error) => console.error("Error al cargar el panel:", error))
      .finally(() => setCargando(false));
  }

  useEffect(() => {
    if (!usuario) return;
    cargarDatos();
  }, [usuario]);

  if (!usuario) return <Navigate to="/" replace />;
  if (cargando || !perfil)
    return <p className="panel-vendedor__cargando">Cargando tu panel...</p>;

  const necesitaVerificar = !perfil.correoVerificado;
  const productosActivos = misProductos.filter((p) => p.activo);
  const productosInactivos = misProductos.filter((p) => !p.activo);

  async function handleCambiarEstado(id: string) {
    await cambiarEstadoProducto(id);
    cargarDatos();
  }

  async function handleEliminar(id: string) {
    const confirmado = window.confirm(
      "¿Seguro que quieres eliminar este producto? Esta acción no se puede deshacer.",
    );
    if (!confirmado) return;
    await eliminarProducto(id);
    cargarDatos();
  }

  function renderProducto(producto: Producto) {
    return (
      <div key={producto._id} className="panel-vendedor__producto-fila">
        <Link
          to={`/producto/${producto._id}`}
          className="panel-vendedor__producto-item"
        >
          <img
            src={`${URL_BACKEND}${producto.imagenes[0]}`}
            alt={producto.nombre}
          />
          <div>
            <p className="panel-vendedor__producto-nombre">{producto.nombre}</p>
            <p className="panel-vendedor__producto-precio">
              ${producto.precio}
            </p>
          </div>
        </Link>
        <div className="panel-vendedor__acciones">
          <Link
            to={`/panel-vendedor/editar/${producto._id}`}
            className="panel-vendedor__editar-btn"
          >
            Editar
          </Link>
          <button
            className="panel-vendedor__estado-btn"
            onClick={() => handleCambiarEstado(producto._id)}
          >
            {producto.activo ? "Desactivar" : "Activar"}
          </button>
          <button
            className="panel-vendedor__eliminar-btn"
            onClick={() => handleEliminar(producto._id)}
          >
            Eliminar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="panel-vendedor">
      <h1>Hola, {perfil.nombreCompleto}</h1>
      <p className="panel-vendedor__correo">{perfil.correo}</p>

      <div className="panel-vendedor__stats">
        <div className="panel-vendedor__stat-card">
          <span className="panel-vendedor__stat-numero">
            {productosActivos.length}
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
        <h2>Activos</h2>
        {productosActivos.length === 0 ? (
          <p className="panel-vendedor__sin-productos">
            No tienes productos activos.
          </p>
        ) : (
          <div className="panel-vendedor__lista-productos">
            {productosActivos.map(renderProducto)}
          </div>
        )}

        <h2>Inactivos</h2>
        {productosInactivos.length === 0 ? (
          <p className="panel-vendedor__sin-productos">
            No tienes productos inactivos.
          </p>
        ) : (
          <div className="panel-vendedor__lista-productos">
            {productosInactivos.map(renderProducto)}
          </div>
        )}
      </div>

      {necesitaVerificar && <VerificacionModal onCompletado={cargarDatos} />}
    </div>
  );
}

export default PanelVendedor;
