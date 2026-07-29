import { useParams } from "react-router-dom";
import Boton from "../../components/Boton/Boton";
import { mockProducts } from "../../Prueba/prueba";
import "./ProductoCompleto.css";

function ProductoCompleto() {
  const { id } = useParams();
  const producto = mockProducts.find((p) => p.id === Number(id));

  if (!producto) {
    return <p>Producto no encontrado</p>;
  }

  return (
    <div>
      <img src={producto.imagen} alt={producto.nombre} />
      <h1>{producto.nombre}</h1>
      <p>${producto.precio}</p>
      <Boton texto="Entrar en la fila" onClick={() => {}} />
    </div>
  );
}

export default ProductoCompleto;
