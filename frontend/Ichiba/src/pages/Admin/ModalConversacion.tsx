import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { fetchMensajesDeVenta } from "../../services/adminService";
import type { Mensaje } from "../../services/mensajeService";
import BurbujaDeTexto from "../../components/BurbujaDeTexto/BurbujaDeTexto";
import "./ModalConversacion.css";

type ModalConversacionProps = {
  titulo: string;
  ventaId: string;
  onCerrar: () => void;
};

function ModalConversacion({
  titulo,
  ventaId,
  onCerrar,
}: ModalConversacionProps) {
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const listaMensajes = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setCargando(true);
    setError("");
    fetchMensajesDeVenta(ventaId)
      .then(setMensajes)
      .catch((err) =>
        setError(
          (axios.isAxiosError(err) && err.response?.data?.message) ||
            "No pudimos cargar la conversación",
        ),
      )
      .finally(() => setCargando(false));
  }, [ventaId]);

  useEffect(() => {
    function manejarTecla(evento: KeyboardEvent) {
      if (evento.key === "Escape") onCerrar();
    }

    window.addEventListener("keydown", manejarTecla);
    return () => window.removeEventListener("keydown", manejarTecla);
  }, [onCerrar]);

  useEffect(() => {
    const contenedor = listaMensajes.current;
    if (contenedor) contenedor.scrollTop = contenedor.scrollHeight;
  }, [mensajes]);

  return (
    <div className="modal-conversacion__fondo" onClick={onCerrar}>
      <div
        className="modal-conversacion"
        onClick={(evento) => evento.stopPropagation()}
      >
        <div className="modal-conversacion__cabecera">
          <div>
            <h2>Conversación de la venta</h2>
            <p className="modal-conversacion__producto">{titulo}</p>
          </div>
          <button
            type="button"
            className="modal-conversacion__cerrar"
            onClick={onCerrar}
            aria-label="Cerrar conversación"
          >
            ✕
          </button>
        </div>

        {error && <p className="modal-conversacion__error">{error}</p>}

        {cargando ? (
          <p className="modal-conversacion__estado">
            Cargando la conversación...
          </p>
        ) : mensajes.length === 0 ? (
          <p className="modal-conversacion__estado">
            Esta venta todavía no tiene mensajes.
          </p>
        ) : (
          <div className="modal-conversacion__lista" ref={listaMensajes}>
            {mensajes.map((mensaje) => (
              <div key={mensaje._id} className="modal-conversacion__mensaje">
                <span
                  className={`modal-conversacion__remitente modal-conversacion__remitente--${mensaje.remitente}`}
                >
                  {mensaje.remitente === "vendedor" ? "Vendedor" : "Comprador"}
                </span>
                <BurbujaDeTexto
                  contenido={mensaje.contenido}
                  imagen={mensaje.imagen}
                  esRemitente={mensaje.remitente === "vendedor"}
                  horario={new Date(mensaje.createdAt).toLocaleString("es-MX")}
                  estadoLectura="leido"
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ModalConversacion;
