import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import "./Inicio.css";
import { fetchProductos, type Producto } from "../../services/productoService";
import CartaProducto from "../../components/CartaProducto/CartaProducto";

/** Minúsculas y sin acentos, para comparar lo que escribe el usuario. */
function acomodar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function Inicio() {
  const [searchParams, setSearchParams] = useSearchParams();
  const categoriaFiltro = searchParams.get("categoria");
  const busqueda = searchParams.get("q") ?? "";

  const [productos, setProductos] = useState<Producto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError(null);

    fetchProductos({
      q: busqueda,
      categoria: categoriaFiltro ?? undefined,
    })
      .then((data) => {
        if (vigente) setProductos(data);
      })
      .catch((errorCarga) => {
        console.error("Error al cargar productos:", errorCarga);
        if (vigente) setError("No se pudieron cargar los productos.");
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });

    return () => {
      vigente = false;
    };
  }, [busqueda, categoriaFiltro]);

  function quitarFiltros() {
    setSearchParams({});
  }

  if (cargando) {
    return <p>Cargando productos...</p>;
  }

  const textoNormalizado = acomodar(busqueda);

  const productosFiltrados = productos.filter((producto) => {
    const coincideCategoria = categoriaFiltro
      ? acomodar(producto.categoria) === acomodar(categoriaFiltro)
      : true;

    const coincideTexto = textoNormalizado
      ? acomodar(
          `${producto.nombre} ${producto.descripcion} ${producto.categoria} ${producto.vendedor}`,
        ).includes(textoNormalizado)
      : true;

    return coincideCategoria && coincideTexto;
  });

  const hayFiltro = Boolean(categoriaFiltro || busqueda);

  return (
    <section className="Contenedor">
      {hayFiltro && (
        <div className="Contenedor__filtro-activo">
          <span>
            Mostrando {productosFiltrados.length} resultado
            {productosFiltrados.length === 1 ? "" : "s"}
            {categoriaFiltro ? ` en ${categoriaFiltro}` : ""}
            {busqueda ? ` para «${busqueda}»` : ""}
          </span>
          <button type="button" onClick={quitarFiltros}>
            Quitar filtro ✕
          </button>
        </div>
      )}

      <div className="Contenedor__Producto">
        {error ? (
          <p>{error}</p>
        ) : productosFiltrados.length === 0 ? (
          <p>
            {hayFiltro
              ? "No encontramos productos con esa búsqueda. Prueba con otras palabras o quita el filtro."
              : "No hay productos en esta categoría todavía."}
          </p>
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
