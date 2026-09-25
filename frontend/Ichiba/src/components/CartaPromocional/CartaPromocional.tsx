import { Link } from "react-router-dom";
import { URL_BACKEND } from "../../services/api";
import { textoPromocional } from "../../configuracion/categorias";
import "./CartaPromocional.css";

type CartaPromocionalProps = {
  id: string;
  nombre: string;
  precio: number;
  imagenes: string[];
  categoria: string;
};

function CartaPromocional({
  id,
  nombre,
  precio,
  imagenes,
  categoria,
}: CartaPromocionalProps) {
  return (
    <Link to={`/promocional/${id}`} className="CartaPromocional__Link">
      <div className="CartaPromocional">
        <span className="CartaPromocional__Etiqueta">
          {textoPromocional(categoria)}
        </span>
        <img
          src={`${URL_BACKEND}${imagenes[0]}`}
          alt={nombre}
          className="CartaPromocional__Imagen"
        />
        <h3 className="CartaPromocional__Nombre">{nombre}</h3>
        <p className="CartaPromocional__Precio">${precio}</p>
        <span className="CartaPromocional__Aviso">
          No se vende en la plataforma
        </span>
      </div>
    </Link>
  );
}

export default CartaPromocional;
