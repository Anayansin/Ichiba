import { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import axios from "axios";
import {
  fetchPromocionales,
  type Promocional,
} from "../../services/promocionalService";
import {
  TIPOS_PROMOCIONAL,
  textoPromocional,
} from "../../configuracion/categorias";
import CartaPromocional from "../../components/CartaPromocional/CartaPromocional";
import "./Promocionales.css";

function Promocionales() {
  const [searchParams] = useSearchParams();
  const tipoFiltro = searchParams.get("tipo");

  const [promocionales, setPromocionales] = useState<Promocional[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    setCargando(true);
    setError("");
    fetchPromocionales(tipoFiltro)
      .then((data) => setPromocionales(data))
      .catch((err) => {
        console.error("Error al cargar promocionales:", err);
        setPromocionales([]);
        setError(
          (axios.isAxiosError(err) && err.response?.data?.message) ||
            "No se pudieron cargar los promocionales. Verifica que el servidor esté activo e intenta de nuevo.",
        );
      })
      .finally(() => setCargando(false));
  }, [tipoFiltro, intento]);

  if (cargando) {
    return <p className="promocionales__cargando">Cargando promocionales...</p>;
  }

  if (error) {
    return (
      <section className="promocionales">
        <p className="promocionales__error">{error}</p>
        <button
          type="button"
          className="promocionales__reintentar"
          onClick={() => setIntento((valor) => valor + 1)}
        >
          Reintentar
        </button>
      </section>
    );
  }

  return (
    <section className="promocionales">
      <header className="promocionales__cabecera">
        <h1>Promocionales</h1>
        <p>
          Artículos y servicios que se anuncian aquí, pero cuya compra se
          coordina <strong>fuera de la plataforma</strong>.
        </p>
      </header>

      <nav className="promocionales__tipos">
        <Link
          to="/promocionales"
          className={`promocionales__tipo ${!tipoFiltro ? "promocionales__tipo--activo" : ""}`}
        >
          Todos
        </Link>
        {TIPOS_PROMOCIONAL.map((tipo) => (
          <Link
            key={tipo.valor}
            to={`/promocionales?tipo=${tipo.valor}`}
            className={`promocionales__tipo ${tipoFiltro === tipo.valor ? "promocionales__tipo--activo" : ""}`}
          >
            {tipo.texto}
          </Link>
        ))}
      </nav>

      {tipoFiltro && (
        <div className="promocionales__filtro">
          <span>Mostrando: {textoPromocional(tipoFiltro)}</span>
          <Link to="/promocionales">Quitar filtro ✕</Link>
        </div>
      )}

      <div className="promocionales__lista">
        {promocionales.length === 0 ? (
          <p>No hay promocionales en esta categoría todavía.</p>
        ) : (
          promocionales.map((promocional) => (
            <CartaPromocional
              key={promocional._id}
              id={promocional._id}
              nombre={promocional.nombre}
              precio={promocional.precio}
              imagenes={promocional.imagenes}
              categoria={promocional.categoria}
            />
          ))
        )}
      </div>
    </section>
  );
}

export default Promocionales;
