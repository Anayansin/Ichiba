import { Link } from "react-router-dom";
import { URL_BACKEND } from "../../services/api";
import "./CartaProducto.css";

type CartaProductoProps = {
  id: string;
  nombre: string;
  precio: number;
  imagenes: string[];
  /** true si el vendedor está dentro de su horario de atención. */
  atendiendo?: boolean;
};

function CartaProducto({
  id,
  nombre,
  precio,
  imagenes,
  atendiendo = true,
}: CartaProductoProps) {
  const claseAtencion = atendiendo
    ? "CartaProducto--atendiendo"
    : "CartaProducto--no-atendiendo";

  return (
    <Link to={`/producto/${id}`} className="CartaProducto__Link">
      <div
        className={`CartaProducto ${claseAtencion}`}
        title={
          atendiendo
            ? "El vendedor está en horario de atención"
            : "El vendedor está fuera de horario de atención"
        }
      >
        <img
          src={`${URL_BACKEND}${imagenes[0]}`}
          alt={nombre}
          className="CartaProducto__Imagen"
        />
        <h3 className="CartaProducto__Nombre">{nombre}</h3>
        <p className="CartaProducto__Precio">${precio}</p>
      </div>
    </Link>
  );
}

export default CartaProducto;
