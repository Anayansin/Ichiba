import BurbujaDeTexto from "../../components/BurbujaDeTexto/BurbujaDeTexto";
import "./Chats.css";

function Chats() {
  return (
    <div>
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
  );
}

export default Chats;
