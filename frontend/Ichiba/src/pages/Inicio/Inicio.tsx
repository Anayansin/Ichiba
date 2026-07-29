import { useEffect, useState } from "react";
import "./Inicio.css";
import CartaProducto from "../../components/CartaProducto/CartaProducto";

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

function Inicio() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [cargando, setCargando] = useState<boolean>(true);

  useEffect(() => {
    const traerProductosDesdeDB = async () => {
      try {
        const respuesta = await fetch("http://localhost:5000/api/productos");
        if (!respuesta.ok) {
          throw new Error("Error en la respuesta del servidor");
        }
        const datos: Producto[] = await respuesta.json();
        setProductos(datos);
      } catch (error) {
        console.error("Error al conectar con MongoDB:", error);
      } finally {
        setCargando(false);
      }
    };

    traerProductosDesdeDB();
  }, []);

  if (cargando) {
    return <p className="Cargando">Cargando productos desde la tienda...</p>;
  }

  return (
    <section className="Contenedor">
      <div className="Contenedor__Producto">
        {productos.length === 0 ? (
          <p className="SinProductos">
            No hay productos disponibles en este momento.
          </p>
        ) : (
          productos.map((producto) => (
            <CartaProducto
              key={producto._id}
              id={producto._id}
              nombre={producto.nombre}
              precio={producto.precio}
              imagenes={producto.imagenes}
            />
          ))
        )}
      </div>
    </section>
  );
}

export default Inicio;
