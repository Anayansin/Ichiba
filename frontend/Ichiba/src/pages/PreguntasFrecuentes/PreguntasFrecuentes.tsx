import ChatSoporte from "../../components/ChatSoporte/ChatSoporte";
import "./PreguntasFrecuentes.css";

function PreguntasFrecuentes() {
  return (
    <div className="faq">
      <h1>Preguntas frecuentes</h1>
      <p className="faq__intro">
        Escribe tu duda en el asistente de soporte y recibe una respuesta al
        instante. También puedes tocar uno de los temas sugeridos.
      </p>

      <ChatSoporte />
    </div>
  );
}

export default PreguntasFrecuentes;
