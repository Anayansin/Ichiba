import { useParams, useNavigate, Link } from "react-router-dom";
import { useState, useEffect } from "react";
import Boton from "../../components/Boton/Boton";
import Carrusel from "../../components/Carrusel/Carrusel";
import TerminosModal, {
  type PreferenciasNotificacion,
} from "../../components/TerminosModal/TerminosModal";
import {
  fetchProductoPorId,
  type Producto,
} from "../../services/productoService";
import {
  entrarEnFila,
  fetchEstadoDeMiFila,
  type EstadoFila,
} from "../../services/colaService";
import { useColas } from "../../context/ColasContext";
import { useAuth } from "../../context/AuthContext";
import {
  textoCondicion,
  textoMetodoEntrega,
  textoTiempoPago,
} from "../../utils/opcionesProducto";
import "./ProductoCompleto.css";
import { crearOrdenPago } from "../../services/pagoService";
import { guardarSuscripcion } from "../../services/notificacionService";

function ProductoCompleto() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { recargarFilas } = useColas();
  const { usuario } = useAuth();

  const [producto, setProducto] = useState<Producto | null>(null);
  const [cargando, setCargando] = useState(true);
  const [mostrarTerminos, setMostrarTerminos] = useState(false);
  const [mensajeFila, setMensajeFila] = useState("");
  const [estadoFila, setEstadoFila] = useState<EstadoFila | null>(null);
  const [segundosRestantes, setSegundosRestantes] = useState<number | null>(
    null,
  );

  useEffect(() => {
    if (!id) return;
    fetchProductoPorId(id)
      .then((data) => setProducto(data))
      .catch((error) => console.error("Error al cargar producto:", error))
      .finally(() => setCargando(false));
  }, [id]);

  useEffect(() => {
    if (!producto) return;

    const productoActual = producto;

    function actualizar() {
      fetchEstadoDeMiFila(productoActual._id)
        .then((data) => {
          if (data.expiro) {
            setEstadoFila(null);
            setMensajeFila(
              data.mensaje || "Se agotó tu tiempo de pago, vuelve a intentarlo",
            );
            recargarFilas();
            return;
          }
          setEstadoFila(data);
        })
        .catch(() => setEstadoFila(null));
    }

    actualizar();
    const intervalo = setInterval(actualizar, 5000);
    return () => clearInterval(intervalo);
  }, [producto]);

  // Cuenta regresiva del tiempo de pago (empieza en la posición 1)
  useEffect(() => {
    const puedePagar = estadoFila?.puedePagar;
    const expira = estadoFila?.pagoExpiraEn;

    if (!puedePagar || !expira) {
      setSegundosRestantes(null);
      return;
    }

    function calcular() {
      const restante = Math.max(
        0,
        Math.floor((new Date(expira as string).getTime() - Date.now()) / 1000),
      );
      setSegundosRestantes(restante);
    }

    calcular();
    const intervalo = setInterval(calcular, 1000);
    return () => clearInterval(intervalo);
  }, [estadoFila?.puedePagar, estadoFila?.pagoExpiraEn]);

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
  async function handlePagar() {
    if (!producto) return;
    try {
      const { linkAprobacion } = await crearOrdenPago(producto._id);
      window.location.href = linkAprobacion;
    } catch (err: any) {
      setMensajeFila(err.response?.data?.message || "Error al iniciar el pago");
    }
  }

  async function handleAceptarTerminos(preferencias: PreferenciasNotificacion) {
    localStorage.setItem("terminosAceptados", "true");
    localStorage.setItem(
      "recibirCorreos",
      String(preferencias.categorias.length > 0),
    );
    localStorage.setItem("correoNotificaciones", preferencias.correo);
    localStorage.setItem(
      "categoriasCorreos",
      JSON.stringify(preferencias.categorias),
    );

    setMostrarTerminos(false);
    setMensajeFila("");

    try {
      await guardarSuscripcion(preferencias.correo, preferencias.categorias);
    } catch (err: any) {
      setMensajeFila(
        err.response?.data?.message ||
          "No se pudieron guardar tus preferencias de notificación, intenta de nuevo",
      );
      return;
    }

    await procesarEntradaFila();
  }

  if (cargando) return <p>Cargando producto...</p>;
  if (!producto)
    return <p className="producto-no-encontrado">Producto no encontrado</p>;

  const esDueño = usuario?.id === producto.vendedorId;

  if (!producto.activo && !esDueño) {
    return (
      <p className="producto-no-encontrado">
        Este producto ya no está disponible
      </p>
    );
  }

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

        {!producto.activo && esDueño && (
          <p className="producto-completo__aviso-inactivo">
            Este producto está desactivado — solo tú puedes verlo así
          </p>
        )}

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
          <h3>Entrega y condiciones</h3>
          <p>
            <strong>Condición:</strong> {textoCondicion(producto.condicion)}
          </p>
          <p>
            <strong>Método de entrega:</strong>{" "}
            {textoMetodoEntrega(producto.metodoEntrega)}
          </p>
          {producto.horarioEntrega && (
            <p>
              <strong>Horario de coordinación de entrega:</strong>{" "}
              {producto.horarioEntrega.inicio} a {producto.horarioEntrega.fin}
            </p>
          )}
          <p>
            <strong>Tiempo límite de pago:</strong>{" "}
            {textoTiempoPago(producto.tiempoLimitePago ?? 60)}
          </p>
          {producto.datosDeEnvio && <p>{producto.datosDeEnvio}</p>}
        </div>

        {estadoFila ? (
          estadoFila.puedePagar ? (
            <div className="producto-completo__pago-listo">
              <p>¡Es tu turno! Estás en la posición 1.</p>
              {segundosRestantes !== null && (
                <p className="producto-completo__temporizador">
                  Tiempo restante para pagar:{" "}
                  <strong>
                    {Math.floor(segundosRestantes / 60)}:
                    {String(segundosRestantes % 60).padStart(2, "0")}
                  </strong>
                </p>
              )}
              <Boton texto="Pagar con PayPal" onClick={handlePagar} />
            </div>
          ) : (
            <div className="producto-completo__esperando">
              <p>Estás en la fila — posición {estadoFila.posicion}</p>
              <span>Debes esperar tu turno para poder pagar</span>
            </div>
          )
        ) : (
          <>
            {mensajeFila && (
              <p className="producto-completo__mensaje-fila">{mensajeFila}</p>
            )}
            <Boton texto="Entrar en la fila" onClick={handleEntrarFila} />
          </>
        )}
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
