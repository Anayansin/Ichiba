import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Boton from "../../components/Boton/Boton";
import {
  fetchProductos,
  fetchCategoriaPopular,
} from "../../services/productoService";
import "./Nosotros.css";

const TOTAL_CATEGORIAS = 6;

interface NosotrosProps {
  onOpenLogin: () => void;
}

function Nosotros({ onOpenLogin }: NosotrosProps) {
  const [categoriaPopular, setCategoriaPopular] = useState<string | null>(null);
  const [productosActivos, setProductosActivos] = useState<number | null>(null);

  useEffect(() => {
    fetchCategoriaPopular()
      .then((data) => setCategoriaPopular(data.categoria))
      .catch(() => setCategoriaPopular(null));

    fetchProductos()
      .then((data) => setProductosActivos(data.length))
      .catch(() => setProductosActivos(null));
  }, []);

  return (
    <div className="nosotros">
      <section className="superior">
        <div className="superior__texto">
          <span className="superior__etiqueta">Ichiba — Mercado digital</span>
          <h1>Vende más, pierde menos tiempo</h1>
          <p>
            Organiza tus ventas mediante una fila virtual. Optimiza la
            interacción entre compradores y vendedores, reduce el tiempo perdido
            y asegura cada transacción con total transparencia.
          </p>
          <div className="superior__botones">
            <Boton texto="Soy Vendedor" onClick={onOpenLogin} />
            <Link to="/inicio">
              <Boton texto="Soy Comprador" onClick={() => {}} />
            </Link>
          </div>
        </div>
      </section>

      <section className="estadisticas">
        <div className="estadisticas__contenedor">
          <div className="estadistica">
            <span className="estadistica__numero">
              {categoriaPopular ?? "—"}
            </span>
            <span className="estadistica__label">Categoría más popular</span>
          </div>

          <div className="estadistica__separador" />

          <div className="estadistica">
            <span className="estadistica__numero">
              {productosActivos !== null ? productosActivos : "—"}
            </span>
            <span className="estadistica__label">Productos activos</span>
          </div>

          <div className="estadistica__separador" />

          <div className="estadistica">
            <span className="estadistica__numero">{TOTAL_CATEGORIAS}</span>
            <span className="estadistica__label">Categorías disponibles</span>
          </div>

          <div className="estadistica__separador" />

          <div className="estadistica">
            <span className="estadistica__numero">3</span>
            <span className="estadistica__label">
              Filas simultáneas por comprador
            </span>
          </div>
        </div>
      </section>

      <section className="propuesta">
        <div className="propuesta__item">
          <span className="propuesta__numero">01</span>
          <h3>Identidad verificada</h3>
          <p>
            Cada vendedor confirma su identidad oficial antes de poder publicar,
            reduciendo el riesgo de fraude para quien compra.
          </p>
        </div>

        <div className="propuesta__item">
          <span className="propuesta__numero">02</span>
          <h3>Fila virtual ordenada</h3>
          <p>
            El proceso de compra respeta el turno de cada persona. Solo quien
            ocupa la posición uno puede completar el pago.
          </p>
        </div>

        <div className="propuesta__item">
          <span className="propuesta__numero">03</span>
          <h3>Reputación pública</h3>
          <p>
            Ventas concluidas y reportes recibidos quedan visibles en el perfil
            de cada vendedor, antes de que decidas comprarle.
          </p>
        </div>
      </section>

      <section className="cierre">
        <div className="cierre__tarjeta">
          <h2>¿Tienes algo que vender?</h2>
          <p>Registra tu cuenta, verifica tu identidad y publica en minutos.</p>
          <Boton texto="Comenzar a vender" onClick={onOpenLogin} />
        </div>

        <div className="cierre__tarjeta cierre__tarjeta--secundaria">
          <h2>¿Buscas algo en particular?</h2>
          <p>
            Explora el catálogo completo, sin necesidad de crear una cuenta.
          </p>
          <Link to="/inicio">
            <Boton texto="Explorar catálogo" onClick={() => {}} />
          </Link>
        </div>
      </section>
    </div>
  );
}

export default Nosotros;
