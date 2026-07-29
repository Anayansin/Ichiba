import { useParams, useNavigate } from "react-router-dom";
import Boton from "../../components/Boton/Boton";
import Carrusel from "../../components/Carrusel/Carrusel";
import { mockProducts } from "../../Prueba/prueba";
import "./ProductoCompleto.css";

function ProductoCompleto() {
  const { id } = useParams();
  const navigate = useNavigate();
  const producto = mockProducts.find((p) => p.id === Number(id));

  if (!producto) {
    return <p className="producto-no-encontrado">Producto no encontrado</p>;
  }

  return (
    <div className="producto-completo">
      <button
        className="producto-completo__volver"
        onClick={() => navigate(-1)}
      >
        ← Volver
      </button>

      <div className="producto-completo__imagen-wrapper">
        <Carrusel imagenes={producto.imagenes} alt={producto.nombre} />
      </div>

      <div className="producto-completo__info">
        <span className="producto-completo__categoria">Categoría</span>
        <h1 className="producto-completo__nombre">{producto.nombre}</h1>
        <p className="producto-completo__precio">${producto.precio}</p>

        <div className="producto-completo__vendedor">
          <div className="producto-completo__avatar" />
          <div>
            <p className="producto-completo__vendedor-label">Vendido por</p>
            <p className="producto-completo__vendedor-nombre">
              Nombre del vendedor
            </p>
          </div>
        </div>

        <div className="producto-completo__descripcion">
          <h3>Descripción</h3>
          <p>
            Aquí va la descripción del producto, materiales, tallas disponibles,
            etc.
          </p>
        </div>

        <div className="producto-completo__envio">
          <h3>Envío</h3>
          <p>Información de tiempos y costos de envío.</p>
        </div>

        <Boton texto="Entrar en la fila" onClick={() => {}} />
      </div>
    </div>
  );
}

export default ProductoCompleto;
