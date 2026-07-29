import "./Inicio.css";
import { mockProducts } from "../../Prueba/prueba";
import CartaProducto from "../../components/CartaProducto/CartaProducto";

function Inicio() {
  return (
    <section className="Contenedor">
      <div className="Contenedor__Producto">
        {mockProducts.map((product) => (
          <CartaProducto
            key={product.id}
            id={product.id}
            nombre={product.nombre}
            precio={product.precio}
            imagenes={product.imagenes}
          />
        ))}
      </div>
    </section>
  );
}

export default Inicio;
