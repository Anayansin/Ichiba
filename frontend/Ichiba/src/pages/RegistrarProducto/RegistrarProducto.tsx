import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Boton from "../../components/Boton/Boton";
import { registrarProducto } from "../../services/productoService";
import "./RegistrarProducto.css";

function RegistarProducto() {
  const navigate = useNavigate();

  const [nombreProducto, setNombreProducto] = useState("");
  const [precio, setPrecio] = useState("");
  const [categoria, setCategoria] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [datosDeEnvio, setDatosDeEnvio] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setCargando(true);

    try {
      await registrarProducto({
        nombre: nombreProducto,
        precio: parseFloat(precio),
        imagenes: [], // Se deja listo para el manejo de archivos
        categoria,
        descripcion,
        datosDeEnvio,
      });

      navigate("/inicio");
    } catch (err: any) {
      const mensaje =
        err.response?.data?.message ||
        "Error al registrar producto. Por favor, intentalo de nuevo.";
      setError(mensaje);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="producto-container">
      <form className="producto-card" onSubmit={handleSubmit}>
        <h2>Publicar un producto</h2>

        {error && <p className="producto-error">{error}</p>}

        <div className="producto-group">
          <label>Nombre del producto</label>
          <input
            type="text"
            className="producto-input"
            placeholder="Nombre del producto"
            value={nombreProducto}
            onChange={(e) => setNombreProducto(e.target.value)}
            required
          />
        </div>

        <div className="producto-group">
          <label>Precio</label>
          <input
            type="number"
            className="producto-input"
            placeholder="Precio del producto"
            value={precio}
            onChange={(e) => setPrecio(e.target.value)}
            required
          />
        </div>

        <div className="producto-group">
          <label>Imágenes</label>
          <input type="file" className="producto-input-file" required />
        </div>

        <div className="producto-group">
          <label>Categoría</label>
          <input
            type="text"
            className="producto-input"
            placeholder="Categoría del producto"
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            required
          />
        </div>

        <div className="producto-group">
          <label>Descripción</label>
          <textarea
            className="producto-input producto-textarea"
            placeholder="Descripción del producto"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            required
          />
        </div>

        <div className="producto-group">
          <label>Datos de Envío</label>
          <input
            type="text"
            className="producto-input"
            placeholder="Información de envío"
            value={datosDeEnvio}
            onChange={(e) => setDatosDeEnvio(e.target.value)}
            required
          />
        </div>

        <Boton
          texto={cargando ? "Registrando..." : "Registrar Producto"}
          onClick={() => {}}
        />
      </form>
    </div>
  );
}

export default RegistarProducto;
