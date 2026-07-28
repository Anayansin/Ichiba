import "./Inicio.css";
import "../../components/CartaProducto/CartaProducto";
import { mockProducts } from "../../Prueba/prueba";
import CartaProducto from "../../components/CartaProducto/CartaProducto";

function Inicio() {
  return (
    <section className="Contenedor">
      <div className="Contenedor__Producto">
        {mockProducts.map((product) => (
          <CartaProducto
            key={product.id}
            nombre={product.nombre}
            precio={product.precio}
            imagen={product.imagen}
          />
        ))}
      </div>
    </section>
  );
}

export default Inicio;
