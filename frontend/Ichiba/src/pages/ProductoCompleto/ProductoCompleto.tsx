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
  esperarProximaApertura,
  fetchEstadoDeMiFila,
  type EstadoFila,
} from "../../services/colaService";
import { useColas } from "../../context/ColasContext";
import { useAuth } from "../../context/AuthContext";
import { mensajeDeError } from "../../utils/errores";
import { textoCategoria } from "../../configuracion/categorias";
import {
  textoCondicion,
  textoMetodoEntrega,
  textoTiempoPago,
} from "../../utils/opcionesProducto";
import "./ProductoCompleto.css";
import { crearOrdenPago } from "../../services/pagoService";
import BotonReportar from "../../components/BotonReportar/BotonReportar";
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
  const [avisoAtencion, setAvisoAtencion] = useState("");
  const [enlacePago, setEnlacePago] = useState("");
  const [avisoLeido, setAvisoLeido] = useState(false);
  const [guardandoEspera, setGuardandoEspera] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetchProductoPorId(id)
      .then((data) => setProducto(data))
      .catch((error) => {
        if (error?.response?.status !== 404) {
          console.error("Error al cargar producto:", error);
        }
      })
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
  }, [producto, recargarFilas]);

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
    } catch (err) {
      setMensajeFila(
        mensajeDeError(err) || "Error al entrar en la fila",
      );
    }
  }
  async function handlePagar() {
    if (!producto) return;
    setMensajeFila("");
    setAvisoLeido(false);
    try {
      const orden = await crearOrdenPago(producto._id);

      if (!orden.linkAprobacion) {
        setMensajeFila(
          "La pasarela de pago no devolvió el enlace. Intenta de nuevo en unos segundos.",
        );
        return;
      }
      setAvisoAtencion(String(orden.avisoAtencion ?? ""));
      setEnlacePago(String(orden.linkAprobacion));
    } catch (err) {
      setMensajeFila(mensajeDeError(err) || "Error al iniciar el pago");
    }
  }

  async function handleEsperarApertura() {
    if (!producto || !estadoFila?.colaId) return;
    setGuardandoEspera(true);
    setMensajeFila("");
    try {
      const respuesta = await esperarProximaApertura(estadoFila.colaId);
      setMensajeFila(respuesta.message);
      recargarFilas();
      const datos = await fetchEstadoDeMiFila(producto._id);
      setEstadoFila(datos);
    } catch (err) {
      setMensajeFila(
        mensajeDeError(err) || "No pudimos guardar tu lugar en la fila",
      );
    } finally {
      setGuardandoEspera(false);
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
    } catch (err) {
      setMensajeFila(
        mensajeDeError(err) ||
          "No se pudieron guardar tus preferencias de notificación, intenta de nuevo",
      );
      return;
    }

    await procesarEntradaFila();
  }

  if (cargando) return <p>Cargando producto...</p>;
  if (!producto)
    return <p className="producto-no-encontrado">Producto no encontrado</p>;

  const esDueño = String(usuario?.id) === String(producto.vendedorId);
  const esAdmin = usuario?.tipo === "admin";

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
          {textoCategoria(producto.categoria)}
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

        {!esDueño && !esAdmin && (
          <div className="producto-completo__reportes">
            <BotonReportar
              elemento="publicacion"
              productoId={producto._id}
              texto="Reportar publicación"
            />
            <BotonReportar
              elemento="vendedor"
              vendedorId={String(producto.vendedorId)}
              texto="Reportar vendedor"
            />
          </div>
        )}

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
          {producto.horarioEntregaInicio && producto.horarioEntregaFin && (
            <p>
              <strong>Horario de coordinación de entrega:</strong>{" "}
              {producto.horarioEntregaInicio} a {producto.horarioEntregaFin}
            </p>
          )}
          <p>
            <strong>Tiempo límite de pago:</strong>{" "}
            {textoTiempoPago(producto.tiempoLimitePago ?? 60)}
          </p>
          {producto.datosDeEnvio && <p>{producto.datosDeEnvio}</p>}
        </div>

        {esAdmin ? (
          <p className="producto-completo__aviso-inactivo">
            Tu cuenta es de administración: supervisa la plataforma, no
            realiza compras.
          </p>
        ) : estadoFila?.esperandoApertura ? (
          <div className="producto-completo__esperando producto-completo__esperando--apertura">
            <p>Guardamos tu lugar — posición {estadoFila.posicion}</p>
            <span>
              El vendedor no está atendiendo en este momento.
              {estadoFila.proximoBloque
                ? ` Su próxima apertura es ${estadoFila.proximoBloque}.`
                : ""}{" "}
              Tu reloj de pago está en pausa y se reanudará cuando abra su
              bloque de atención; te avisaremos por correo.
            </span>
            {mensajeFila && (
              <p className="producto-completo__mensaje-fila">{mensajeFila}</p>
            )}
          </div>
        ) : estadoFila &&
          estadoFila.enFila !== false &&
          estadoFila.posicion !== null ? (
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
              {estadoFila.puedeElegirEspera && estadoFila.avisoAtencion && (
                <p className="producto-completo__aviso-atencion">
                  {estadoFila.avisoAtencion}
                </p>
              )}
              {enlacePago ? (
                <div className="producto-completo__aviso-pago">
                  <p className="producto-completo__aviso-pago-titulo">
                    Antes de pagar, ten en cuenta:
                  </p>
                  <p className="producto-completo__aviso-pago-texto">
                    {avisoAtencion ||
                      "La atención y respuesta del vendedor se brindará exclusivamente dentro de su bloque de horario de atención vigente."}
                  </p>
                  <label className="producto-completo__aviso-casilla">
                    <input
                      type="checkbox"
                      checked={avisoLeido}
                      onChange={(e) => setAvisoLeido(e.target.checked)}
                    />
                    He leído y acepto este aviso
                  </label>
                  <div className="producto-completo__aviso-pago-acciones">
                    <Boton
                      texto="Continuar a PayPal"
                      disabled={!avisoLeido}
                      onClick={() => {
                        window.location.href = enlacePago;
                      }}
                    />
                    <button
                      type="button"
                      className="producto-completo__cancelar-pago"
                      onClick={() => {
                        setEnlacePago("");
                        setAvisoAtencion("");
                        setAvisoLeido(false);
                      }}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : estadoFila.puedeElegirEspera ? (
                <div className="producto-completo__eleccion-espera">
                  <div className="producto-completo__advertencia-bloque">
                    <p>
                      <strong>Pagar ahora:</strong> dispondrás de todo el
                      tiempo límite de pago, pero no podrás comunicarte con el
                      vendedor ni recibir atención hasta su siguiente bloque
                      {estadoFila.proximoBloque
                        ? ` (${estadoFila.proximoBloque})`
                        : ""}
                      .
                    </p>
                    <p>
                      <strong>Esperar al siguiente bloque:</strong> conservas
                      el primer lugar y tu tiempo límite de pago iniciará al
                      comenzar dicho bloque.
                    </p>
                  </div>
                  <div className="producto-completo__eleccion-botones">
                    <Boton texto="Pagar ahora" onClick={handlePagar} />
                    <button
                      type="button"
                      className="producto-completo__esperar-boton"
                      onClick={handleEsperarApertura}
                      disabled={guardandoEspera}
                    >
                      {guardandoEspera
                        ? "Guardando tu lugar..."
                        : "Esperar al siguiente bloque"}
                    </button>
                  </div>
                </div>
              ) : (
                <Boton texto="Pagar con PayPal" onClick={handlePagar} />
              )}
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
            {estadoFila?.horarioActivo === false ? (
              <div className="producto-completo__fuera-horario">
                <Boton texto="Entrar en la fila" disabled onClick={() => {}} />
                <p className="producto-completo__fuera-horario-titulo">
                  El vendedor no está en horario de atención
                </p>
                <p className="producto-completo__fuera-horario-texto">
                  {estadoFila.proximoBloque
                    ? `Su próxima apertura es ${estadoFila.proximoBloque}. Podrás entrar a la fila cuando abra su bloque de atención.`
                    : "El vendedor no tiene bloques de atención programados por ahora."}
                </p>
              </div>
            ) : (
              <Boton texto="Entrar en la fila" onClick={handleEntrarFila} />
            )}
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
