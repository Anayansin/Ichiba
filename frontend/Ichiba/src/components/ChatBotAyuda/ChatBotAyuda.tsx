import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  BASE_CONOCIMIENTO,
  buscarRespuesta,
  normalizar,
  type EntradaConocimiento,
} from "../ChatSoporte/baseConocimiento";
import "./ChatBotAyuda.css";

type MensajeAyuda = {
  id: number;
  autor: "bot" | "usuario";
  texto: string;
  invitaAyuda?: boolean;
};

const MENSAJE_INICIAL: MensajeAyuda = {
  id: 1,
  autor: "bot",
  texto: "¡Hola! 👋 Soy el asistente de ayuda de Ichiba. Escribe tu duda y te respondo al instante.",
};

const MENSAJE_SIN_COINCIDENCIA =
  "No encontré una respuesta para eso 😅. Prueba con otras palabras o visita la sección de Ayuda, donde están las preguntas frecuentes y todo lo relacionado con la plataforma.";

function palabraCoincide(
  palabra: string,
  palabrasEntrada: Set<string>,
): boolean {
  if (palabrasEntrada.has(palabra)) return true;
  if (palabra.length < 5) return false;

  const principio = palabra.slice(0, 5);
  for (const palabraEntrada of palabrasEntrada) {
    if (palabraEntrada.startsWith(principio)) return true;
  }

  return false;
}

function buscarPreguntaParecida(consulta: string): EntradaConocimiento | null {
  const coincidenciaDirecta = buscarRespuesta(consulta);
  if (coincidenciaDirecta) return coincidenciaDirecta;

  const palabras = normalizar(consulta)
    .split(" ")
    .filter((palabra) => palabra.length > 3);

  if (palabras.length === 0) return null;

  let preguntaParecida: EntradaConocimiento | null = null;
  let mejorNumeroDeCoincidencias = 0;

  for (const entrada of BASE_CONOCIMIENTO) {
    const palabrasEntrada = new Set(
      normalizar([entrada.pregunta, ...entrada.claves].join(" ")).split(" "),
    );
    const coincidencias = palabras.filter((palabra) =>
      palabraCoincide(palabra, palabrasEntrada),
    ).length;

    if (coincidencias > mejorNumeroDeCoincidencias) {
      mejorNumeroDeCoincidencias = coincidencias;
      preguntaParecida = entrada;
    }
  }

  return preguntaParecida;
}

function ChatBotAyuda() {
  const [abierto, setAbierto] = useState(false);
  const [mensajes, setMensajes] = useState<MensajeAyuda[]>([MENSAJE_INICIAL]);
  const [texto, setTexto] = useState("");
  const siguienteId = useRef(2);
  const contenedorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const contenedor = contenedorRef.current;
    if (contenedor) contenedor.scrollTop = contenedor.scrollHeight;
  }, [mensajes]);

  function enviarDuda(evento: React.FormEvent) {
    evento.preventDefault();

    const duda = texto.trim();
    if (!duda) return;

    const coincidencia = buscarPreguntaParecida(duda);
    const idMensajeUsuario = siguienteId.current++;
    const idMensajeBot = siguienteId.current++;

    setMensajes((anteriores) => [
      ...anteriores,
      { id: idMensajeUsuario, autor: "usuario", texto: duda },
      {
        id: idMensajeBot,
        autor: "bot",
        texto: coincidencia ? coincidencia.respuesta : MENSAJE_SIN_COINCIDENCIA,
        invitaAyuda: !coincidencia,
      },
    ]);

    setTexto("");
  }

  return (
    <div className="chat-ayuda">
      {abierto && (
        <div
          className="chat-ayuda__ventana"
          role="dialog"
          aria-label="Asistente de ayuda"
        >
          <header className="chat-ayuda__cabecera">
            <span className="chat-ayuda__avatar" aria-hidden="true">
              🤖
            </span>
            <div className="chat-ayuda__titulo">
              <p>Asistente de ayuda</p>
              <span>Respuestas instantáneas a tus dudas</span>
            </div>
            <button
              type="button"
              className="chat-ayuda__cerrar"
              onClick={() => setAbierto(false)}
              aria-label="Cerrar el chat de ayuda"
            >
              ✕
            </button>
          </header>

          <div
            className="chat-ayuda__mensajes"
            ref={contenedorRef}
            aria-live="polite"
          >
            {mensajes.map((mensaje) => (
              <div
                key={mensaje.id}
                className={`chat-ayuda__mensaje chat-ayuda__mensaje--${mensaje.autor}`}
              >
                <p>
                  {mensaje.texto}
                  {mensaje.invitaAyuda && (
                    <>
                      {" "}
                      <Link
                        className="chat-ayuda__enlace"
                        to="/ayuda"
                        onClick={() => setAbierto(false)}
                      >
                        Ir a Ayuda
                      </Link>
                    </>
                  )}
                </p>
              </div>
            ))}
          </div>

          <form className="chat-ayuda__formulario" onSubmit={enviarDuda}>
            <input
              type="text"
              placeholder="Escribe tu duda aquí..."
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              aria-label="Escribe tu duda"
            />
            <button type="submit" disabled={!texto.trim()}>
              Enviar
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        className="chat-ayuda__boton"
        onClick={() => setAbierto((estado) => !estado)}
        aria-label={
          abierto ? "Cerrar el chat de ayuda" : "Abrir el chat de ayuda"
        }
      >
        {abierto ? "✕" : "💬"}
      </button>
    </div>
  );
}

export default ChatBotAyuda;
