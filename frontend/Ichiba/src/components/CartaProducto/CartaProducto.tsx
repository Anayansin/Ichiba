import { Link } from "react-router-dom";
import "./CartaProducto.css";

type CartaProductoProps = {
  id: number;
  nombre: string;
  precio: number;
  imagenes: string[];
};

function CartaProducto({ id, nombre, precio, imagenes }: CartaProductoProps) {
  return (
    <Link to={`/producto/${id}`} className="CartaProducto__Link">
      <div className="CartaProducto">
        <img src={imagenes[0]} alt={nombre} className="CartaProducto__Imagen" />
        <h3 className="CartaProducto__Nombre">{nombre}</h3>
        <p className="CartaProducto__Precio">${precio}</p>
      </div>
    </Link>
  );
}

export default CartaProducto;
