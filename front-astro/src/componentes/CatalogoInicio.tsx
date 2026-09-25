import { useState, useEffect } from "react";
import { fetchProductos, type Producto } from "../servicios/productoService";
import CartaProducto from "./CartaProducto";

function CatalogoInicio() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [categoriaFiltro, setCategoriaFiltro] = useState<string | null>(null);

  useEffect(() => {
    const parametrosDeUrl = new URLSearchParams(window.location.search);
    setCategoriaFiltro(parametrosDeUrl.get("categoria"));
  }, []);

  useEffect(() => {
    fetchProductos()
      .then((datos) => setProductos(datos))
      .catch((error) => console.error("Error al cargar productos:", error))
      .finally(() => setCargando(false));
  }, []);

  if (cargando) {
    return <p>Cargando productos...</p>;
  }

  const productosFiltrados = categoriaFiltro
    ? productos.filter(
        (producto) =>
          producto.categoria.toLowerCase() === categoriaFiltro.toLowerCase(),
      )
    : productos;

  return (
    <section className="Contenedor">
      {categoriaFiltro && (
        <div className="Contenedor__filtro-activo">
          <span>Mostrando: {categoriaFiltro}</span>
          <a href="/inicio">Quitar filtro ✕</a>
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

export default CatalogoInicio;
