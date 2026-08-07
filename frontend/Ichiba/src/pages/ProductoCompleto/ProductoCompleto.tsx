import { useParams, useNavigate, Link } from "react-router-dom";
import { useState, useEffect } from "react";
import Boton from "../../components/Boton/Boton";
import Carrusel from "../../components/Carrusel/Carrusel";
import TerminosModal from "../../components/TerminosModal/TerminosModal";
import {
  fetchProductoPorId,
  type Producto,
} from "../../services/productoService";
import { entrarEnFila } from "../../services/colaService";
import { useColas } from "../../context/ColasContext";
import "./ProductoCompleto.css";

function ProductoCompleto() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { recargarFilas } = useColas();
  const [producto, setProducto] = useState<Producto | null>(null);
  const [cargando, setCargando] = useState(true);
  const [mostrarTerminos, setMostrarTerminos] = useState(false);
  const [mensajeFila, setMensajeFila] = useState("");

  useEffect(() => {
    if (!id) return;
    fetchProductoPorId(id)
      .then((data) => setProducto(data))
      .catch((error) => console.error("Error al cargar producto:", error))
      .finally(() => setCargando(false));
  }, [id]);

  async function handleEntrarFila() {
    const yaAceptoTerminos =
      localStorage.getItem("terminosAceptados") === "true";

    if (!yaAceptoTerminos) {
      setMostrarTerminos(true);
      return;
    }

    await procesarEntradaFila();
  }

  async function procesarEntradaFila() {
    if (!producto) return;
    setMensajeFila("");

    try {
      await entrarEnFila(producto._id);
      recargarFilas();
      setMensajeFila("¡Entraste a la fila!");
    } catch (err: any) {
      setMensajeFila(
        err.response?.data?.message || "Error al entrar en la fila",
      );
    }
  }

  function handleAceptarTerminos(recibirCorreos: boolean, categoria: string) {
    localStorage.setItem("terminosAceptados", "true");
    localStorage.setItem("recibirCorreos", String(recibirCorreos));
    if (recibirCorreos) localStorage.setItem("categoriaCorreos", categoria);

    setMostrarTerminos(false);
    procesarEntradaFila();
  }

  if (cargando) return <p>Cargando producto...</p>;
  if (!producto)
    return <p className="producto-no-encontrado">Producto no encontrado</p>;

  return (
    <div className="producto-completo">
      <button
        className="producto-completo__volver"
        onClick={() => navigate(-1)}
      >
        ← Volver
      </button>

      <div className="producto-completo__imagen-wrapper">
        <Carrusel imagenes={producto.imagenes} alt={producto.nombre} />
      </div>

      <div className="producto-completo__info">
        <span className="producto-completo__categoria">
          {producto.categoria}
        </span>
        <h1 className="producto-completo__nombre">{producto.nombre}</h1>
        <p className="producto-completo__precio">${producto.precio}</p>

        <Link
          to={`/vendedor/${producto.vendedorId}`}
          className="producto-completo__vendedor"
        >
          <div className="producto-completo__avatar" />
          <div>
            <p className="producto-completo__vendedor-label">Vendido por</p>
            <p className="producto-completo__vendedor-nombre">
              {producto.vendedor}
            </p>
          </div>
        </Link>

        <div className="producto-completo__descripcion">
          <h3>Descripción</h3>
          <p>{producto.descripcion}</p>
        </div>

        <div className="producto-completo__envio">
          <h3>Envío</h3>
          <p>{producto.datosDeEnvio}</p>
        </div>

        {mensajeFila && (
          <p className="producto-completo__mensaje-fila">{mensajeFila}</p>
        )}

        <Boton texto="Entrar en la fila" onClick={handleEntrarFila} />
      </div>

      {mostrarTerminos && (
        <TerminosModal
          onAceptar={handleAceptarTerminos}
          onCerrar={() => setMostrarTerminos(false)}
        />
      )}
    </div>
  );
}

export default ProductoCompleto;
