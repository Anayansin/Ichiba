import { Link } from "react-router-dom";
import { URL_BACKEND } from "../../services/api";
import "./CartaProducto.css";

type CartaProductoProps = {
  id: string;
  nombre: string;
  precio: number;
  imagenes: string[];
  atendiendo?: boolean;
  proximoBloque?: string | null;
};

function CartaProducto({
  id,
  nombre,
  precio,
  imagenes,
  atendiendo = true,
  proximoBloque = null,
}: CartaProductoProps) {
  const claseAtencion = atendiendo
    ? "CartaProducto--atendiendo"
    : "CartaProducto--no-atendiendo";

  return (
    <Link to={`/producto/${id}`} className="CartaProducto__Link">
      <article className={`CartaProducto ${claseAtencion}`}>
        <div className="CartaProducto__Marco">
          <img
            src={`${URL_BACKEND}${imagenes[0]}`}
            alt={nombre}
            className="CartaProducto__Imagen"
            loading="lazy"
          />
          <div className="CartaProducto__Disponibilidad" role="status">
            {atendiendo ? (
              <strong>Disponible</strong>
            ) : (
              <>
                <strong>Inactivo por horario</strong>
                {proximoBloque && <span>Atiende {proximoBloque}</span>}
              </>
            )}
          </div>
        </div>
        <h3 className="CartaProducto__Nombre">{nombre}</h3>
        <p className="CartaProducto__Precio">${precio}</p>
      </article>
    </Link>
  );
}

export default CartaProducto;
