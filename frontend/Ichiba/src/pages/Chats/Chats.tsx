import { useState, useEffect } from "react";
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
import { URL_BACKEND } from "../../services/api";
import BurbujaDeTexto from "../../components/BurbujaDeTexto/BurbujaDeTexto";
import "./Chats.css";

function Chats() {
  const { usuario } = useAuth();
  const esVendedor = !!usuario;

  const [ventas, setVentas] = useState<VentaConProducto[]>([]);
  const [ventaActivaId, setVentaActivaId] = useState<string | null>(null);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [texto, setTexto] = useState("");
  const [cargandoVentas, setCargandoVentas] = useState(true);

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

    function cargarMensajes() {
      fetchMensajesFn(ventaActivaId as string)
        .then((data) => setMensajes(data))
        .catch((error) => console.error("Error al cargar mensajes:", error));
    }

    cargarMensajes();
    const intervalo = setInterval(cargarMensajes, 3000);
    return () => clearInterval(intervalo);
  }, [ventaActivaId]);

  async function handleEnviar(e: React.FormEvent) {
    e.preventDefault();
    if (!texto.trim() || !ventaActivaId) return;

    try {
      await enviarMensajeFn(ventaActivaId, texto.trim());
      setTexto("");
      const data = await fetchMensajesFn(ventaActivaId);
      setMensajes(data);
    } catch (error) {
      console.error("Error al enviar mensaje:", error);
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
            <div className="chats__mensajes">
              {mensajes.map((mensaje) => (
                <BurbujaDeTexto
                  key={mensaje._id}
                  contenido={mensaje.contenido}
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

            <form className="chat-formulario" onSubmit={handleEnviar}>
              <input
                type="text"
                className="chat-input"
                placeholder="Escribe un mensaje..."
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
              />
              <button type="submit" className="chat-boton-enviar">
                ➤
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}

export default Chats;
