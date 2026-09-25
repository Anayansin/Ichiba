import { URL_BACKEND } from "../servicios/api";

type PropiedadesDeCartaProducto = {
  id: string;
  nombre: string;
  precio: number;
  imagenes: string[];
};

function CartaProducto({
  id,
  nombre,
  precio,
  imagenes,
}: PropiedadesDeCartaProducto) {
  return (
    <a href={`/producto/${id}`} className="CartaProducto__Link">
      <div className="CartaProducto">
        <img
          src={`${URL_BACKEND}${imagenes[0]}`}
          alt={nombre}
          className="CartaProducto__Imagen"
        />
        <h3 className="CartaProducto__Nombre">{nombre}</h3>
        <p className="CartaProducto__Precio">${precio}</p>
      </div>
    </a>
  );
}

export default CartaProducto;
