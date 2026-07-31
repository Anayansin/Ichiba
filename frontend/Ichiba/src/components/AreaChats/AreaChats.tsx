import BurbujaDeTexto from "../../components/BurbujaDeTexto/BurbujaDeTexto";
import "./AreaChats.css";

function Chats() {
  return (
    <div className="chat-pagina">
      <div className="contenedor-chat">
        <BurbujaDeTexto
          contenido="Hola, ¿el producto sigue disponible?"
          esRemitente={false}
          horario="10:32"
          estadoLectura="leido"
        />
        <BurbujaDeTexto
          contenido="Sí, todavía tengo stock"
          esRemitente={true}
          horario="10:33"
          estadoLectura="leido"
        />
      </div>
    </div>
  );
}

export default Chats;
