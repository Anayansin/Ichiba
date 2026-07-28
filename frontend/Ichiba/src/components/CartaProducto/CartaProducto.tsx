import "./CartaProducto.css";

type CartaProductoProps = {
  nombre: string;
  precio: number;
  imagen: string;
};

function CartaProducto({ nombre, precio, imagen }: CartaProductoProps) {
  return (
    <div className="CartaProducto">
      <img src={imagen} alt={nombre} className="CartaProducto__Imagen" />
      <h3 className="CartaProducto__Nombre">{nombre}</h3>
      <p className="CartaProducto__Precio">${precio}</p>
    </div>
  );
}

export default CartaProducto;
