import { Link } from "react-router-dom";
import Boton from "../../components/Boton/Boton";
import "./Nosotros.css";

interface NosotrosProps {
  onOpenLogin: () => void;
}

function Nosotros({ onOpenLogin }: NosotrosProps) {
  return (
    <div className="nosotros">
      <section className="superior">
        <div className="superior__texto">
          <h1>Vende Mas, Pierde Menos Tiempo</h1>
          <p>
            Organiza tus ventas mediante una fila virtual. Optimiza la
            interaccion entre compradores y vendedores, reduce el tiempo perdido
            y asegura cada transaccion con total trasparencia
          </p>
          <Boton texto="Soy Vendedor" onClick={onOpenLogin}></Boton>
          <Link to={"/Inicio"}>
            <Boton texto="Soy Comprador" onClick={() => {}}></Boton>
          </Link>
        </div>
      </section>
    </div>
  );
}

export default Nosotros;
