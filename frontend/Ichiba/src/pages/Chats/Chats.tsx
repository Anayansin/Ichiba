import { useState, useEffect, useRef } from "react";
import axios from "axios";
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
import { URL_BACKEND } from "../../services/api";
import BurbujaDeTexto from "../../components/BurbujaDeTexto/BurbujaDeTexto";
import "./Chats.css";

const TAMANIO_MAXIMO_IMAGEN = 5 * 1024 * 1024; // 5 MB (límite del backend)
const TIPOS_IMAGEN_PERMITIDOS = ["image/jpeg", "image/png", "image/webp"];

function Chats() {
  const { usuario } = useAuth();
  const esVendedor = !!usuario;

  const [ventas, setVentas] = useState<VentaConProducto[]>([]);
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
  }, [esVendedor]);

  useEffect(() => {
    if (!ventaActivaId) return;

    // Al cambiar de conversación se limpia el adjunto pendiente
    quitarImagen();

    function cargarMensajes() {
      fetchMensajesFn(ventaActivaId as string)
        .then((data) => setMensajes(data))
        .catch((error) => console.error("Error al cargar mensajes:", error));
    }

    cargarMensajes();
    setErrorChat("");
    const intervalo = setInterval(cargarMensajes, 5000);
    return () => clearInterval(intervalo);
  }, [ventaActivaId]);

  const ventaActiva = ventas.find((venta) => venta._id === ventaActivaId);

  function quitarImagen() {
    if (previewImagen) URL.revokeObjectURL(previewImagen);
    setImagen(null);
    setPreviewImagen(null);
    if (inputImagenRef.current) inputImagenRef.current.value = "";
  }

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
              <span>{venta.productoId.nombre}</span>
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
