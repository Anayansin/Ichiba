import { useState, useEffect } from "react";
import {
  consultarProductos,
  type ProductoCatalogo,
} from "../servicios/clienteGraphql";
import CartaProducto from "./CartaProducto";

function CatalogoInicio() {
  const [productos, setProductos] = useState<ProductoCatalogo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [categoriaFiltro, setCategoriaFiltro] = useState<string | null>(null);

  useEffect(() => {
    const parametrosDeUrl = new URLSearchParams(window.location.search);
    setCategoriaFiltro(parametrosDeUrl.get("categoria"));
  }, []);

  useEffect(() => {
    consultarProductos()
      .then((datos) => setProductos(datos))
      .catch((errorCarga) =>
        console.error("Error al cargar productos:", errorCarga),
      )
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
              key={producto.id}
              id={producto.id}
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
