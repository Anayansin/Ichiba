import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import {
  fetchPerfilPublico,
  type PerfilPublico,
} from "../../services/usuarioServices";
import { URL_BACKEND } from "../../services/api";
import "./PerfilDelVendedor.css";

function VendedorPerfil() {
  const { id } = useParams();
  const [perfil, setPerfil] = useState<PerfilPublico | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!id) return;
    fetchPerfilPublico(id)
      .then((data) => setPerfil(data))
      .catch((error) => console.error("Error al cargar perfil:", error))
      .finally(() => setCargando(false));
  }, [id]);

  if (cargando)
    return <p className="vendedor-perfil__cargando">Cargando perfil...</p>;
  if (!perfil)
    return <p className="vendedor-perfil__cargando">Vendedor no encontrado</p>;

  return (
    <div className="vendedor-perfil">
      <h1>{perfil.usuario.nombreCompleto}</h1>

      <div className="vendedor-perfil__stats">
        <div className="vendedor-perfil__stat-card">
          <span className="vendedor-perfil__stat-numero">
            {perfil.productos.length}
          </span>
          <span className="vendedor-perfil__stat-label">Productos activos</span>
        </div>
        <div className="vendedor-perfil__stat-card">
          <span className="vendedor-perfil__stat-numero">
            {perfil.usuario.ventasExitosas}
          </span>
          <span className="vendedor-perfil__stat-label">
            Ventas concluidas sin problemas
          </span>
        </div>
        <div className="vendedor-perfil__stat-card">
          <span className="vendedor-perfil__stat-numero">
            {perfil.usuario.reportes}
          </span>
          <span className="vendedor-perfil__stat-label">
            Reportes recibidos
          </span>
        </div>
      </div>

      <div className="vendedor-perfil__productos">
        <h2>Productos en venta</h2>
        {perfil.productos.length === 0 ? (
          <p className="vendedor-perfil__sin-productos">
            Este vendedor no tiene productos activos.
          </p>
        ) : (
          <div className="vendedor-perfil__lista">
            {perfil.productos.map((producto) => (
              <Link
                key={producto._id}
                to={`/producto/${producto._id}`}
                className="vendedor-perfil__item"
              >
                <img
                  src={`${URL_BACKEND}${producto.imagenes[0]}`}
                  alt={producto.nombre}
                />
                <div>
                  <p>{producto.nombre}</p>
                  <span>${producto.precio}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default VendedorPerfil;
