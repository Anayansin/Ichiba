import { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import "./Inicio.css";
import { fetchProductos, type Producto } from "../../services/productoService";
import CartaProducto from "../../components/CartaProducto/CartaProducto";

function Inicio() {
  const [searchParams] = useSearchParams();
  const categoriaFiltro = searchParams.get("categoria");

  const [productos, setProductos] = useState<Producto[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    fetchProductos()
      .then((data) => setProductos(data))
      .catch((error) => console.error("Error al cargar productos:", error))
      .finally(() => setCargando(false));
  }, []);

  if (cargando) {
    return <p>Cargando productos...</p>;
  }

  const productosFiltrados = categoriaFiltro
    ? productos.filter(
        (p) => p.categoria.toLowerCase() === categoriaFiltro.toLowerCase(),
      )
    : productos;

  return (
    <section className="Contenedor">
      {categoriaFiltro && (
        <div className="Contenedor__filtro-activo">
          <span>Mostrando: {categoriaFiltro}</span>
          <Link to="/inicio">Quitar filtro ✕</Link>
        </div>
      )}

      <div className="Contenedor__Producto">
        {productosFiltrados.length === 0 ? (
          <p>No hay productos en esta categoría todavía.</p>
        ) : (
          productosFiltrados.map((producto) => (
            <CartaProducto
              key={producto._id}
              id={producto._id}
              nombre={producto.nombre}
              precio={producto.precio}
              imagenes={producto.imagenes}
            />
          ))
        )}
      </div>
    </section>
  );
}

export default Inicio;
