import { useParams, useNavigate, Link } from "react-router-dom";
import { useState, useEffect } from "react";
import Carrusel from "../../components/Carrusel/Carrusel";
import {
  fetchPromocionalPorId,
  type Promocional,
} from "../../services/promocionalService";
import { textoPromocional } from "../../configuracion/categorias";
import { useAuth } from "../../context/AuthContext";
import "./PromocionalDetalle.css";

function PromocionalDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { usuario } = useAuth();

  const [promocional, setPromocional] = useState<Promocional | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!id) return;
    fetchPromocionalPorId(id)
      .then((data) => setPromocional(data))
      .catch((error) => console.error("Error al cargar promocional:", error))
      .finally(() => setCargando(false));
  }, [id]);

  if (cargando) return <p>Cargando promocional...</p>;
  if (!promocional)
    return <p className="promocional-detalle__no-encontrado">Promocional no encontrado</p>;

  const esDueno = usuario?.id === promocional.vendedorId;

  if (!promocional.activo && !esDueno) {
    return (
      <p className="promocional-detalle__no-encontrado">
        Este promocional ya no está disponible
      </p>
    );
  }

  return (
    <div className="promocional-detalle">
      <button
        className="promocional-detalle__volver"
        onClick={() => navigate(-1)}
      >
        ← Volver
      </button>

      <div className="promocional-detalle__imagen-wrapper">
        <Carrusel
          imagenes={promocional.imagenes}
          alt={promocional.nombre}
        />
      </div>

      <div className="promocional-detalle__info">
        <span className="promocional-detalle__categoria">
          Promocional · {textoPromocional(promocional.categoria)}
        </span>
        <h1 className="promocional-detalle__nombre">
          {promocional.nombre}
        </h1>
        <p className="promocional-detalle__precio">
          ${promocional.precio}
        </p>

        {!promocional.activo && esDueno && (
          <p className="promocional-detalle__aviso-inactivo">
            Este promocional está desactivado — solo tú puedes verlo así
          </p>
        )}

        <div className="promocional-detalle__aviso">
          <h3>Este artículo no se vende en la plataforma</h3>
          <p>
            ICHIBA solo lo anuncia. La compra, el precio final y la entrega se
            coordinan <strong>directamente con el vendedor</strong>, fuera de la
            plataforma y sin pago a través de ICHIBA.
          </p>
        </div>

        <Link
          to={`/vendedor/${promocional.vendedorId}`}
          className="promocional-detalle__vendedor"
        >
          <div className="promocional-detalle__avatar" />
          <div>
            <p className="promocional-detalle__vendedor-label">Anunciado por</p>
            <p className="promocional-detalle__vendedor-nombre">
              {promocional.vendedor}
            </p>
          </div>
        </Link>

        <div className="promocional-detalle__descripcion">
          <h3>Descripción</h3>
          <p>{promocional.descripcion}</p>
        </div>

        <Link
          to="/promocionales"
          className="promocional-detalle__ver-mas"
        >
          Ver más promocionales
        </Link>
      </div>
    </div>
  );
}

export default PromocionalDetalle;
