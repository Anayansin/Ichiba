import { Link } from "react-router-dom";
import "./CartaProducto.css";

type CartaProductoProps = {
  id: number;
  nombre: string;
  precio: number;
  imagen: string;
};

function CartaProducto({ id, nombre, precio, imagen }: CartaProductoProps) {
  return (
    <Link to={`/producto/${id}`} className="CartaProducto__Link">
      <div className="CartaProducto">
        <img src={imagen} alt={nombre} className="CartaProducto__Imagen" />
        <h3 className="CartaProducto__Nombre">{nombre}</h3>
        <p className="CartaProducto__Precio">${precio}</p>
      </div>
    </Link>
  );
}

export default CartaProducto;
