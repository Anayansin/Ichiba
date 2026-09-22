import { useEffect, useRef, useState } from "react";
import {
  BASE_CONOCIMIENTO,
  PREGUNTA_NO_ENTENDIDA,
  SALUDO,
  buscarRespuesta,
} from "./baseConocimiento";
import "./ChatSoporte.css";

type Autor = "bot" | "usuario";

type Mensaje = {
  id: number;
  autor: Autor;
  texto: string;
};

const TEMAS_SUGERIDOS = [
  "fila-virtual",
  "cuenta-comprar",
  "maximo-filas",
  "chat-vendedor",
  "verificacion-vendedor",
  "horario-vendedor",
  "tiempo-pago",
  "metodo-entrega",
  "recuperar-contrasena",
  "reportar-vendedor",
  "sanciones",
  "notificaciones",
  "como-funciona",
]
  .map((id) => BASE_CONOCIMIENTO.find((entrada) => entrada.id === id))
  .filter((entrada): entrada is NonNullable<typeof entrada> => Boolean(entrada));

const MENSAJE_INICIAL: Mensaje = { id: 1, autor: "bot", texto: SALUDO };

function ChatSoporte() {
  const [mensajes, setMensajes] = useState<Mensaje[]>([MENSAJE_INICIAL]);
  const [texto, setTexto] = useState("");
  const [escribiendo, setEscribiendo] = useState(false);

  const siguienteId = useRef(2);
  const temporizador = useRef<number | null>(null);
  const contenedorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const contenedor = contenedorRef.current;
    if (contenedor) contenedor.scrollTop = contenedor.scrollHeight;
  }, [mensajes, escribiendo]);

  useEffect(() => {
    return () => {
      if (temporizador.current) window.clearTimeout(temporizador.current);
    };
  }, []);

  function agregarMensaje(autor: Autor, contenido: string) {
    setMensajes((prev) => [
      ...prev,
      { id: siguienteId.current++, autor, texto: contenido },
    ]);
  }

  function enviar(contenido: string) {
    const consulta = contenido.trim();
    if (!consulta || escribiendo) return;

    agregarMensaje("usuario", consulta);
    setTexto("");
    setEscribiendo(true);

    temporizador.current = window.setTimeout(() => {
      const entrada = buscarRespuesta(consulta);
      agregarMensaje(
        "bot",
        entrada ? entrada.respuesta : PREGUNTA_NO_ENTENDIDA,
      );
      setEscribiendo(false);
    }, 700);
  }

  function reiniciar() {
    if (temporizador.current) window.clearTimeout(temporizador.current);
    setEscribiendo(false);
    setTexto("");
    siguienteId.current = 2;
    setMensajes([MENSAJE_INICIAL]);
  }

  return (
    <section className="chat-soporte" aria-label="Asistente automatizado de soporte">
      <header className="chat-soporte__header">
        <span className="chat-soporte__avatar" aria-hidden="true">
          🤖
        </span>
        <div className="chat-soporte__titulo">
          <h2>Asistente de soporte</h2>
          <p>Respuestas instantáneas a tus dudas frecuentes</p>
        </div>
        <button
          type="button"
          className="chat-soporte__reiniciar"
          onClick={reiniciar}
        >
          Reiniciar
        </button>
      </header>

      <div
        className="chat-soporte__mensajes"
        ref={contenedorRef}
        aria-live="polite"
      >
        {mensajes.map((mensaje) => (
          <div
            key={mensaje.id}
            className={`chat-soporte__mensaje chat-soporte__mensaje--${mensaje.autor}`}
          >
            {mensaje.autor === "bot" && (
              <span className="chat-soporte__mini-avatar" aria-hidden="true">
                🤖
              </span>
            )}
            <p>{mensaje.texto}</p>
          </div>
        ))}

        {escribiendo && (
          <div className="chat-soporte__mensaje chat-soporte__mensaje--bot">
            <span className="chat-soporte__mini-avatar" aria-hidden="true">
              🤖
            </span>
            <span className="chat-soporte__escribiendo" aria-label="Escribiendo">
              <i />
              <i />
              <i />
            </span>
          </div>
        )}
      </div>

      <div className="chat-soporte__temas">
        <span>Temas frecuentes:</span>
        {TEMAS_SUGERIDOS.map((entrada) => (
          <button
            key={entrada.id}
            type="button"
            onClick={() => enviar(entrada.pregunta)}
            disabled={escribiendo}
          >
            {entrada.pregunta}
          </button>
        ))}
      </div>

      <form
        className="chat-soporte__formulario"
        onSubmit={(e) => {
          e.preventDefault();
          enviar(texto);
        }}
      >
        <input
          type="text"
          placeholder="Escribe tu duda aquí..."
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          aria-label="Escribe tu duda"
        />
        <button
          type="submit"
          disabled={!texto.trim() || escribiendo}
        >
          Enviar
        </button>
      </form>
    </section>
  );
}

export default ChatSoporte;
