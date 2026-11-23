import { useState, useEffect } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  fetchMisVentasComprador,
  fetchMisVentasVendedor,
  fetchMensajesComprador,
  fetchMensajesVendedor,
  enviarMensajeComprador,
  enviarMensajeVendedor,
  type VentaConProducto,
  type Mensaje,
} from "../../services/mensajeService";
import BotonReportar from "../../components/BotonReportar/BotonReportar";
import CoordinacionEntrega from "../../components/CoordinacionEntrega/CoordinacionEntrega";
import { URL_BACKEND } from "../../services/api";
import { calificarVenta } from "../../services/pagoService";
import BurbujaDeTexto from "../../components/BurbujaDeTexto/BurbujaDeTexto";
import EtiquetaEstadoVenta from "../../components/EtiquetaEstadoVenta/EtiquetaEstadoVenta";
import "./Chats.css";

const FORMATO_FECHA_CHAT = new Intl.DateTimeFormat("es-MX", {
  timeZone: "America/Mexico_City",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

type VentaConCalificacion = VentaConProducto & {
  calificacionComprador?: number | null;
  calificacionVendedor?: number | null;
};

const estiloPanelCalificacion: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: "0.75rem",
  padding: "0.7rem 1.2rem",
  borderTop: "1px solid #eee",
  background: "#ffffff",
  fontSize: "0.88rem",
  fontWeight: 600,
  color: "#333",
};

const estiloEstrellas: React.CSSProperties = {
  display: "flex",
  gap: "0.15rem",
};

const estiloEstrella: React.CSSProperties = {
  background: "none",
  border: "none",
  padding: 0,
  fontSize: "1.6rem",
  lineHeight: 1,
  color: "#d90429",
  cursor: "pointer",
};

const estiloEstrellaDeshabilitada: React.CSSProperties = {
  ...estiloEstrella,
  cursor: "default",
  opacity: 0.55,
};

function Chats() {
  const { usuario } = useAuth();
  const esVendedor = !!usuario;

  const [ventas, setVentas] = useState<VentaConCalificacion[]>([]);
  const [ventaActivaId, setVentaActivaId] = useState<string | null>(null);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [texto, setTexto] = useState("");
  const [cargandoVentas, setCargandoVentas] = useState(true);
  const [errorChat, setErrorChat] = useState("");

  const [calificacionEnviando, setCalificacionEnviando] = useState(false);
  const [calificacionesEnviadas, setCalificacionesEnviadas] = useState<
    string[]
  >([]);
  const [calificacionError, setCalificacionError] = useState("");

  const fetchVentas = esVendedor
    ? fetchMisVentasVendedor
    : fetchMisVentasComprador;
  const fetchMensajesFn = esVendedor
    ? fetchMensajesVendedor
    : fetchMensajesComprador;
  const enviarMensajeFn = esVendedor
    ? enviarMensajeVendedor
    : enviarMensajeComprador;

  useEffect(() => {
    fetchVentas()
      .then((data) => setVentas(data))
      .catch((error) => console.error("Error al cargar conversaciones:", error))
      .finally(() => setCargandoVentas(false));
  }, [esVendedor, fetchVentas]);

  useEffect(() => {
    if (!ventaActivaId) return;

    function cargarMensajes() {
      fetchMensajesFn(ventaActivaId as string)
        .then((data) => setMensajes(data))
        .catch((error) => console.error("Error al cargar mensajes:", error));
    }

    function actualizarVentas() {
      fetchVentas()
        .then((data) => setVentas(data))
        .catch((error) => console.error("Error al refrescar compras:", error));
    }

    cargarMensajes();
    setErrorChat("");
    setCalificacionError("");
    const intervalo = setInterval(() => {
      cargarMensajes();
      actualizarVentas();
    }, 5000);
    return () => clearInterval(intervalo);
  }, [ventaActivaId, fetchMensajesFn, fetchVentas]);

  const ventaActiva = ventas.find((venta) => venta._id === ventaActivaId);

  const chatHabilitado = ventaActiva?.estado === "en_entrega";

  function motivoChatBloqueado(): string {
    switch (ventaActiva?.estado) {
      case "pendiente_comprobante":
        return esVendedor
          ? "El chat se abrirá cuando el comprador registre su comprobante de pago."
          : "El chat se abrirá cuando registres tu comprobante de pago y el vendedor lo confirme.";
      case "pendiente_confirmacion":
        return esVendedor
          ? "El chat está bloqueado hasta que revises y confirmes el comprobante de pago del comprador."
          : "El chat está bloqueado hasta que el vendedor revise y confirme tu comprobante de pago.";
      case "completada":
        return "La transacción concluyó y los fondos fueron liberados: el chat quedó deshabilitado.";
      case "cancelada":
      case "reembolsada":
        return `Esta compra fue cancelada${
          ventaActiva?.canceladoMotivo
            ? ` (${ventaActiva.canceladoMotivo})`
            : ""
        }: el chat quedó deshabilitado.`;
      default:
        return "El chat de esta compra todavía no está disponible.";
    }
  }

  const calificacionPropia = esVendedor
    ? ventaActiva?.calificacionVendedor
    : ventaActiva?.calificacionComprador;

  const puedeCalificar =
    !!ventaActiva &&
    ventaActiva.estado === "completada" &&
    !calificacionesEnviadas.includes(ventaActiva._id) &&
    typeof calificacionPropia !== "number";

  async function handleEnviar(e: React.FormEvent) {
    e.preventDefault();
    const textoLimpio = texto.trim();
    if (!textoLimpio || !ventaActivaId) return;

    try {
      await enviarMensajeFn(ventaActivaId, textoLimpio);
      setTexto("");
      setErrorChat("");
      const data = await fetchMensajesFn(ventaActivaId);
      setMensajes(data);
    } catch (error) {
      setErrorChat(
        (axios.isAxiosError(error) && error.response?.data?.message) ||
          "Error al enviar el mensaje",
      );
    }
  }

  async function handleCalificar(puntuacion: number) {
    if (!ventaActivaId || calificacionEnviando) return;

    setCalificacionEnviando(true);
    setCalificacionError("");
    try {
      await calificarVenta(ventaActivaId, {
        quienCalifica: esVendedor ? "vendedor" : "comprador",
        puntuacion,
      });
      setCalificacionesEnviadas((anteriores) => [
        ...anteriores,
        ventaActivaId,
      ]);
      const ventasActualizadas = await fetchVentas();
      setVentas(ventasActualizadas);
    } catch (error) {
      setCalificacionError(
        (axios.isAxiosError(error) && error.response?.data?.message) ||
          "Error al enviar la calificación",
      );
    } finally {
      setCalificacionEnviando(false);
    }
  }

  if (cargandoVentas)
    return <p className="chats__cargando">Cargando tus conversaciones...</p>;

  return (
    <div className="chats">
      <aside className="chats__lista">
        <h2>Conversaciones</h2>
        {ventas.length === 0 ? (
          <p className="chats__sin-conversaciones">
            Aún no tienes conversaciones. Los chats se habilitan después de
            completar un pago.
          </p>
        ) : (
          ventas.map((venta) => (
            <button
              key={venta._id}
              className={`chats__item ${ventaActivaId === venta._id ? "chats__item--activo" : ""}`}
              onClick={() => setVentaActivaId(venta._id)}
            >
              <img
                src={`${URL_BACKEND}${venta.productoId.imagenes[0]}`}
                alt={venta.productoId.nombre}
              />
              <span>
                {venta.productoId.nombre}
                <EtiquetaEstadoVenta
                  estado={venta.estado}
                  rol={esVendedor ? "vendedor" : "comprador"}
                />
              </span>
            </button>
          ))
        )}
      </aside>

      <section className="chats__activo">
        {!ventaActivaId ? (
          <p className="chats__sin-seleccion">Selecciona una conversación</p>
        ) : (
          <>
            <div className="chats__cabecera">
              <span className="chats__cabecera-nombre">
                {ventaActiva?.productoId.nombre || "Conversación"}
              </span>
              <BotonReportar
                elementos={esVendedor ? ["cliente", "mensaje"] : ["vendedor", "mensaje"]}
                ventaId={ventaActivaId}
                className="chats__boton-reportar"
              />
            </div>

            <div className="chats__mensajes">
              {mensajes.map((mensaje) => (
                <BurbujaDeTexto
                  key={mensaje._id}
                  contenido={mensaje.contenido}
                  emisor={
                    mensaje.remitente === "vendedor" ? "Vendedor" : "Comprador"
                  }
                  esRemitente={
                    esVendedor
                      ? mensaje.remitente === "vendedor"
                      : mensaje.remitente === "comprador"
                  }
                  horario={FORMATO_FECHA_CHAT.format(new Date(mensaje.createdAt))}
                />
              ))}
            </div>

            {ventaActiva?.estado === "en_entrega" && (
              <div className="chats__entrega">
                <p className="chats__nota-entrega">
                  📦 Estás en la etapa de entrega.{" "}
                  {esVendedor
                    ? "Cuando el comprador reciba el producto, pídele su código de confirmación de 4 dígitos y regístralo en tu panel, en «Ventas y entregas»."
                    : "Dale tu código de confirmación al vendedor únicamente cuando recibas el producto; con él se libera el dinero retenido."}
                </p>

                {!esVendedor && ventaActiva?.codigoEntrega && (
                  <div className="chats__codigo-entrega">
                    <span className="chats__codigo-titulo">
                      Tu código de confirmación de entrega
                    </span>
                    <span className="chats__codigo-digitos">
                      {ventaActiva.codigoEntrega}
                    </span>
                    <span className="chats__codigo-nota">
                      Compártelo con el vendedor solo al recibir el producto.
                    </span>
                  </div>
                )}
              </div>
            )}

            {ventaActiva?.estado === "en_entrega" && ventaActivaId && (
              <CoordinacionEntrega
                ventaId={ventaActivaId}
                esVendedor={esVendedor}
              />
            )}

            {puedeCalificar && (
              <div style={estiloPanelCalificacion}>
                <span>
                  {esVendedor
                    ? "Califica al comprador de esta compra"
                    : "Califica al vendedor de esta compra"}
                </span>
                <div style={estiloEstrellas}>
                  {[1, 2, 3, 4, 5].map((estrella) => (
                    <button
                      key={estrella}
                      type="button"
                      style={
                        calificacionEnviando
                          ? estiloEstrellaDeshabilitada
                          : estiloEstrella
                      }
                      onClick={() => handleCalificar(estrella)}
                      disabled={calificacionEnviando}
                      title={`${estrella} de 5`}
                      aria-label={`Calificar con ${estrella} ${
                        estrella === 1 ? "estrella" : "estrellas"
                      }`}
                    >
                      ★
                    </button>
                  ))}
                </div>
                {calificacionError && (
                  <p
                    className="chats__error"
                    style={{ margin: 0, flexBasis: "100%" }}
                  >
                    {calificacionError}
                  </p>
                )}
              </div>
            )}

            {chatHabilitado ? (
              <>
                {errorChat && <p className="chats__error">{errorChat}</p>}

                <form className="chat-formulario" onSubmit={handleEnviar}>
                  <input
                    type="text"
                    className="chat-input"
                    placeholder="Escribe un mensaje..."
                    maxLength={1000}
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    aria-label="Escribe un mensaje"
                  />
                  <button
                    type="submit"
                    className="chat-boton-enviar"
                    disabled={!texto.trim()}
                  >
                    Enviar
                  </button>
                </form>
              </>
            ) : (
              <div className="chats__bloqueado">
                <p>🔒 {motivoChatBloqueado()}</p>

                {ventaActiva?.estado === "pendiente_comprobante" &&
                  !esVendedor &&
                  ventaActiva.ventaIdPg && (
                    <Link
                      className="chats__bloqueado-enlace"
                      to={`/pago-exitoso?venta=${ventaActiva.ventaIdPg}`}
                    >
                      Registrar mi comprobante de pago
                    </Link>
                  )}

                {ventaActiva?.estado === "pendiente_confirmacion" &&
                  esVendedor && (
                    <Link className="chats__bloqueado-enlace" to="/panel-vendedor">
                      Revisar el comprobante en mi panel
                    </Link>
                  )}
              </div>
            )}
          </>
        )}
      </section>

    </div>
  );
}

export default Chats;
