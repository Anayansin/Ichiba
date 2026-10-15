import { useState, useEffect, useRef, useCallback } from "react";
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
import { crearReporte } from "../../services/reporteService";
import {
  CATEGORIAS_REPORTE,
  ELEMENTOS_REPORTE,
} from "../../configuracion/categoriasReporte";
import api, { URL_BACKEND } from "../../services/api";
import BurbujaDeTexto from "../../components/BurbujaDeTexto/BurbujaDeTexto";
import EtiquetaEstadoVenta from "../../components/EtiquetaEstadoVenta/EtiquetaEstadoVenta";
import "./Chats.css";

const TAMANIO_MAXIMO_IMAGEN = 5 * 1024 * 1024; // 5 MB (límite del backend)
const TIPOS_IMAGEN_PERMITIDOS = ["image/jpeg", "image/png", "image/webp"];

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

  // Imagen adjunta pendiente de enviar
  const [imagen, setImagen] = useState<File | null>(null);
  const [previewImagen, setPreviewImagen] = useState<string | null>(null);
  const inputImagenRef = useRef<HTMLInputElement>(null);

  // Reporte de la conversación activa (ambos lados: comprador y vendedor)
  const [mostrarReporte, setMostrarReporte] = useState(false);
  const [reporteElemento, setReporteElemento] = useState(
    ELEMENTOS_REPORTE[0].id,
  );
  const [reporteCategoria, setReporteCategoria] = useState(
    CATEGORIAS_REPORTE[0].id,
  );
  const [reporteDetalle, setReporteDetalle] = useState("");
  const [reporteError, setReporteError] = useState("");
  const [reporteEnviando, setReporteEnviando] = useState(false);
  const [reporteEnviado, setReporteEnviado] = useState(false);

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

  const quitarImagen = useCallback(() => {
    setPreviewImagen((imagenPrevia) => {
      if (imagenPrevia) URL.revokeObjectURL(imagenPrevia);
      return null;
    });
    setImagen(null);
    if (inputImagenRef.current) inputImagenRef.current.value = "";
  }, []);

  useEffect(() => {
    if (!ventaActivaId) return;

    // Al cambiar de conversación se limpia el adjunto pendiente
    quitarImagen();

    function cargarMensajes() {
      fetchMensajesFn(ventaActivaId as string)
        .then((data) => setMensajes(data))
        .catch((error) => console.error("Error al cargar mensajes:", error));
    }

    // RQNF4: el estado del escrow puede cambiar (el vendedor confirma el
    // comprobante o registra la entrega), así que también se refresca para
    // habilitar o deshabilitar el chat sin recargar la página.
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
  }, [ventaActivaId, fetchMensajesFn, fetchVentas, quitarImagen]);

  const ventaActiva = ventas.find((venta) => venta._id === ventaActivaId);

  // RQNF24.2 / RQNF26 / RQNF29: el chat solo se escribe en `en_entrega`
  // (mientras se revisa el comprobante queda bloqueado y al concluir o
  // cancelarse la compra queda deshabilitado).
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

  // RQF27: la calificación se hace después de confirmada la entrega.
  const puedeCalificar =
    !!ventaActiva &&
    ventaActiva.estado === "completada" &&
    !calificacionesEnviadas.includes(ventaActiva._id) &&
    typeof calificacionPropia !== "number";

  function handleSeleccionImagen(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    e.target.value = "";
    if (!archivo) return;

    if (!TIPOS_IMAGEN_PERMITIDOS.includes(archivo.type)) {
      setErrorChat("Solo puedes adjuntar imágenes (jpg, png o webp)");
      return;
    }

    if (archivo.size > TAMANIO_MAXIMO_IMAGEN) {
      setErrorChat("La imagen no puede superar los 5 MB");
      return;
    }

    quitarImagen();
    setErrorChat("");
    setImagen(archivo);
    setPreviewImagen(URL.createObjectURL(archivo));
  }

  async function handleEnviar(e: React.FormEvent) {
    e.preventDefault();
    const textoLimpio = texto.trim();
    if ((!textoLimpio && !imagen) || !ventaActivaId) return;

    try {
      await enviarMensajeFn(ventaActivaId, textoLimpio, imagen);
      setTexto("");
      quitarImagen();
      setErrorChat("");
      const data = await fetchMensajesFn(ventaActivaId);
      setMensajes(data);
    } catch (error) {
      // Muestra errores de palabras prohibidas y de sanciones (bloqueos)
      setErrorChat(
        (axios.isAxiosError(error) && error.response?.data?.message) ||
          "Error al enviar el mensaje",
      );
    }
  }

  function abrirReporte() {
    setReporteError("");
    setReporteEnviado(false);
    setReporteDetalle("");
    setMostrarReporte(true);
  }

  function cerrarReporte() {
    setMostrarReporte(false);
    setReporteError("");
  }

  async function handleReporte(e: React.FormEvent) {
    e.preventDefault();
    if (!ventaActivaId) return;

    setReporteError("");
    setReporteEnviando(true);
    try {
      await crearReporte({
        ventaId: ventaActivaId,
        elemento: reporteElemento,
        categoria: reporteCategoria,
        detalle: reporteDetalle.trim(),
      });
      setReporteEnviado(true);
    } catch (err) {
      setReporteError(
        (axios.isAxiosError(err) && err.response?.data?.message) ||
          "Error al enviar el reporte",
      );
    } finally {
      setReporteEnviando(false);
    }
  }

  async function handleCalificar(puntuacion: number) {
    if (!ventaActivaId || calificacionEnviando) return;

    setCalificacionEnviando(true);
    setCalificacionError("");
    try {
      await api.post(`/pagos/${ventaActivaId}/calificar`, {
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
              <button
                type="button"
                className="chats__boton-reportar"
                onClick={abrirReporte}
              >
                ⚠ Reportar
              </button>
            </div>

            <div className="chats__mensajes">
              {mensajes.map((mensaje) => (
                <BurbujaDeTexto
                  key={mensaje._id}
                  contenido={mensaje.contenido}
                  imagen={mensaje.imagen}
                  esRemitente={
                    esVendedor
                      ? mensaje.remitente === "vendedor"
                      : mensaje.remitente === "comprador"
                  }
                  horario={new Date(mensaje.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  estadoLectura="leido"
                />
              ))}
            </div>

            {ventaActiva?.estado === "en_entrega" && (
              <p className="chats__nota-entrega">
                📦 Estás en la etapa de entrega: coordinen aquí el lugar, la
                fecha y la hora. Al entregar el producto, dale tu código de
                confirmación al vendedor para cerrar la transacción.
              </p>
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

                {previewImagen && (
                  <div className="chats__adjunto-preview">
                    <img src={previewImagen} alt="Imagen por enviar" />
                    <button
                      type="button"
                      onClick={quitarImagen}
                      aria-label="Quitar imagen adjunta"
                    >
                      ✕
                    </button>
                  </div>
                )}

                <form className="chat-formulario" onSubmit={handleEnviar}>
                  <input
                    ref={inputImagenRef}
                    type="file"
                    accept="image/jpeg, image/png, image/webp"
                    onChange={handleSeleccionImagen}
                    hidden
                  />
                  <button
                    type="button"
                    className="chat-boton-adjuntar"
                    onClick={() => inputImagenRef.current?.click()}
                    aria-label="Adjuntar imagen"
                    title="Adjuntar imagen (jpg, png o webp, máximo 5 MB)"
                  >
                    📎
                  </button>
                  <input
                    type="text"
                    className="chat-input"
                    placeholder={
                      imagen
                        ? "Añade un texto o envía la imagen..."
                        : "Escribe un mensaje..."
                    }
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    aria-label="Escribe un mensaje"
                  />
                  <button
                    type="submit"
                    className="chat-boton-enviar"
                    disabled={!texto.trim() && !imagen}
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

      {mostrarReporte && (
        <div className="chats__modal-fondo" onClick={cerrarReporte}>
          <div
            className="chats__modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <h3>Reportar en esta conversación</h3>

            {reporteEnviado ? (
              <>
                <p className="chats__modal-exito">
                  Reporte enviado. Nuestro equipo lo revisará a la brevedad.
                </p>
                <div className="chats__modal-acciones">
                  <button
                    type="button"
                    className="chats__boton-reportar"
                    onClick={cerrarReporte}
                  >
                    Cerrar
                  </button>
                </div>
              </>
            ) : (
              <form onSubmit={handleReporte}>
                <label>
                  ¿Qué quieres reportar?
                  <select
                    value={reporteElemento}
                    onChange={(e) => setReporteElemento(e.target.value)}
                  >
                    {ELEMENTOS_REPORTE.map((op) => (
                      <option key={op.id} value={op.id}>
                        {op.nombre}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Categoría
                  <select
                    value={reporteCategoria}
                    onChange={(e) => setReporteCategoria(e.target.value)}
                  >
                    {CATEGORIAS_REPORTE.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.nombre} ({cat.tipoFalta})
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Detalle (opcional)
                  <textarea
                    rows={3}
                    maxLength={1000}
                    placeholder="Cuéntanos qué sucedió"
                    value={reporteDetalle}
                    onChange={(e) => setReporteDetalle(e.target.value)}
                  />
                </label>

                {reporteError && (
                  <p className="chats__modal-error">{reporteError}</p>
                )}

                <div className="chats__modal-acciones">
                  <button
                    type="button"
                    className="chats__modal-cancelar"
                    onClick={cerrarReporte}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="chats__boton-reportar"
                    disabled={reporteEnviando}
                  >
                    {reporteEnviando ? "Enviando..." : "Enviar reporte"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Chats;
