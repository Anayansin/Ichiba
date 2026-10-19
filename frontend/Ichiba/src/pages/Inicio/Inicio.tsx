import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import "./Inicio.css";
import {
  fetchProductosPaginados,
  type Producto,
} from "../../services/productoService";
import CartaProducto from "../../components/CartaProducto/CartaProducto";

const PRODUCTOS_POR_PAGINA = 12;

function Inicio() {
  const [searchParams, setSearchParams] = useSearchParams();
  const categoriaFiltro = searchParams.get("categoria");
  const busqueda = searchParams.get("q") ?? "";

  const [productos, setProductos] = useState<Producto[]>([]);
  const [total, setTotal] = useState(0);
  const [hayMas, setHayMas] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorMas, setErrorMas] = useState<string | null>(null);

  const centinelaRef = useRef<HTMLDivElement | null>(null);
  const paginaRef = useRef(1);
  const cargandoRef = useRef(false);
  const hayMasRef = useRef(false);
  const generacionRef = useRef(0);

  const cargarPagina = useCallback(
    async (numeroPagina: number, reemplazar: boolean, generacion: number) => {
      if (cargandoRef.current) return;
      cargandoRef.current = true;

      if (reemplazar) {
        setCargando(true);
        setError(null);
      } else {
        setCargandoMas(true);
        setErrorMas(null);
      }

      try {
        const data = await fetchProductosPaginados(
          {
            q: busqueda,
            categoria: categoriaFiltro ?? undefined,
          },
          numeroPagina,
          PRODUCTOS_POR_PAGINA,
        );

        // Si mientras tanto cambió el filtro, esta respuesta ya no sirve.
        if (generacion !== generacionRef.current) return;

        if (!Array.isArray(data.productos)) {
          throw new Error("El servidor no devolvió una página de productos");
        }

        setProductos((anteriores) => {
          if (reemplazar) return data.productos;

          const idsCargados = new Set(
            anteriores.map((producto) => producto._id),
          );
          return [
            ...anteriores,
            ...data.productos.filter(
              (producto) => !idsCargados.has(producto._id),
            ),
          ];
        });
        const quedanMas = data.hayMas && data.productos.length > 0;

        setTotal(data.total);
        setHayMas(quedanMas);
        hayMasRef.current = quedanMas;
        paginaRef.current = data.pagina;
      } catch (errorCarga) {
        if (generacion !== generacionRef.current) return;

        console.error("Error al cargar productos:", errorCarga);
        if (reemplazar) {
          setError("No se pudieron cargar los productos.");
        } else {
          setErrorMas("No se pudieron cargar más productos.");
        }
      } finally {
        if (generacion === generacionRef.current) {
          cargandoRef.current = false;
          setCargando(false);
          setCargandoMas(false);
        }
      }
    },
    [busqueda, categoriaFiltro],
  );

  const reiniciar = useCallback(() => {
    generacionRef.current += 1;
    const generacion = generacionRef.current;

    cargandoRef.current = false;
    paginaRef.current = 1;
    hayMasRef.current = true;

    setProductos([]);
    setTotal(0);
    setHayMas(true);
    setCargando(true);
    setCargandoMas(false);
    setError(null);
    setErrorMas(null);

    void cargarPagina(1, true, generacion);
  }, [cargarPagina]);

  useEffect(() => {
    reiniciar();

    return () => {
      generacionRef.current += 1;
    };
  }, [reiniciar]);

  const cargarSiguiente = useCallback(() => {
    if (cargandoRef.current || !hayMasRef.current) return;
    void cargarPagina(paginaRef.current + 1, false, generacionRef.current);
  }, [cargarPagina]);

  /**
   * Intersection Observer: cuando el centinela del final del listado entra
   * en el viewport (con 300 px de anticipación), pedimos la siguiente página.
   * El observer se vuelve a crear después de cada carga para que pueda
   * dispararse otra vez si el centinela sigue visible.
   */
  useEffect(() => {
    const centinela = centinelaRef.current;
    if (!centinela || !hayMas || cargando || cargandoMas || errorMas) return;

    const observador = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((entrada) => entrada.isIntersecting)) {
          cargarSiguiente();
        }
      },
      { rootMargin: "300px 0px" },
    );

    observador.observe(centinela);
    return () => observador.disconnect();
  }, [hayMas, cargando, cargandoMas, errorMas, cargarSiguiente]);

  function quitarFiltros() {
    setSearchParams({});
  }

  const hayFiltro = Boolean(categoriaFiltro || busqueda);

  if (cargando && productos.length === 0) {
    return <p>Cargando productos...</p>;
  }

  return (
    <section className="Contenedor">
      {hayFiltro && (
        <div className="Contenedor__filtro-activo">
          <span>
            Mostrando {productos.length} de {total} resultado
            {total === 1 ? "" : "s"}
            {categoriaFiltro ? ` en ${categoriaFiltro}` : ""}
            {busqueda ? ` para «${busqueda}»` : ""}
          </span>
          <button type="button" onClick={quitarFiltros}>
            Quitar filtro ✕
          </button>
        </div>
      )}

      {error ? (
        <div className="Contenedor__estado">
          <p>{error}</p>
          <button type="button" onClick={reiniciar}>
            Reintentar
          </button>
        </div>
      ) : productos.length === 0 ? (
        <p>
          {hayFiltro
            ? "No encontramos productos con esa búsqueda. Prueba con otras palabras o quita el filtro."
            : "Todavía no hay productos publicados."}
        </p>
      ) : (
        <>
          <div className="Contenedor__Producto">
            {productos.map((producto) => (
              <CartaProducto
                key={producto._id}
                id={producto._id}
                nombre={producto.nombre}
                precio={producto.precio}
                imagenes={producto.imagenes}
                atendiendo={producto.vendedorAtendiendo ?? true}
              />
            ))}
          </div>

          <div
            ref={centinelaRef}
            className="Contenedor__centinela"
            aria-hidden="true"
          />

          {cargandoMas && (
            <p className="Contenedor__cargando-mas" role="status">
              Cargando más productos...
            </p>
          )}

          {errorMas && (
            <div className="Contenedor__estado">
              <p>{errorMas}</p>
              <button type="button" onClick={cargarSiguiente}>
                Reintentar
              </button>
            </div>
          )}

          {!hayMas && !cargandoMas && !errorMas && (
            <p className="Contenedor__fin">Has visto todos los productos.</p>
          )}
        </>
      )}
    </section>
  );
}

export default Inicio;
