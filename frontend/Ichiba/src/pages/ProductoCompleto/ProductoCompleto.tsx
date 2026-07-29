import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import Boton from "../../components/Boton/Boton";
import Carrusel from "../../components/Carrusel/Carrusel";
import "./ProductoCompleto.css";

interface Producto {
  _id: string;
  nombre: string;
  precio: number;
  imagenes: string[];
  categoria: string;
  descripcion: string;
  vendedor: string;
  datosDeEnvio: string;
}

function ProductoCompleto() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [producto, setProducto] = useState<Producto | null>(null);
  const [cargando, setCargando] = useState<boolean>(true);

  useEffect(() => {
    const traerProductoPorId = async () => {
      try {
        const respuesta = await fetch(
          `http://localhost:5000/api/productos/${id}`,
        );
        if (!respuesta.ok) {
          throw new Error(
            "No se encontró el producto o hubo un error en el servidor",
          );
        }
        const datos: Producto = await respuesta.json();
        setProducto(datos);
      } catch (error) {
        console.error("Error al conectar con MongoDB:", error);
      } finally {
        setCargando(false);
      }
    };

    if (id) {
      traerProductoPorId();
    }
  }, [id]);

  if (cargando) {
    return <p className="Cargando">Cargando detalles del producto...</p>;
  }

  if (!producto) {
    return (
      <div className="producto-completo">
        <p>El producto solicitado no existe.</p>
        <button
          className="producto-completo__volver"
          onClick={() => navigate(-1)}
        >
          ← Volver
        </button>
      </div>
    );
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
        {}
        <span className="producto-completo__categoria">
          {producto.categoria}
        </span>
        <h1 className="producto-completo__nombre">{producto.nombre}</h1>
        <p className="producto-completo__precio">${producto.precio} MXN</p>

        <div className="producto-completo__vendedor">
          <div className="producto-completo__avatar" />
          <div>
            <p className="producto-completo__vendedor-label">Vendido por</p>
            <p className="producto-completo__vendedor-nombre">
              {producto.vendedor}
            </p>
          </div>
        </div>

        <div className="producto-completo__descripcion">
          <h3>Descripción</h3>
          <p>{producto.descripcion}</p>
        </div>

        <div className="producto-completo__envio">
          <h3>Envío</h3>
          <p>{producto.datosDeEnvio}</p>
        </div>

        <Boton texto="Entrar en la fila" onClick={() => {}} />
      </div>
    </div>
  );
}

export default ProductoCompleto;
