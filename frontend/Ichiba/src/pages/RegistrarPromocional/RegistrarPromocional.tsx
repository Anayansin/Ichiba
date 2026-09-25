import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import axios from "axios";
import Boton from "../../components/Boton/Boton";
import { crearPromocional } from "../../services/promocionalService";
import { useAuth } from "../../context/AuthContext";
import { TIPOS_PROMOCIONAL } from "../../configuracion/categorias";
import "../RegistrarProducto/RegistrarProducto.css";
import "./RegistrarPromocional.css";

const MAX_IMAGENES = 6;

function RegistrarPromocional() {
  const { usuario } = useAuth();
  const navigate = useNavigate();

  const [nombre, setNombre] = useState("");
  const [precio, setPrecio] = useState("");
  const [categoria, setCategoria] = useState(TIPOS_PROMOCIONAL[0].valor);
  const [descripcion, setDescripcion] = useState("");
  const [archivos, setArchivos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  if (!usuario) {
    return <Navigate to="/" replace />;
  }

  function handleSeleccionArchivos(e: React.ChangeEvent<HTMLInputElement>) {
    const nuevosArchivos = Array.from(e.target.files || []);

    if (archivos.length + nuevosArchivos.length > MAX_IMAGENES) {
      setError(`Puedes subir máximo ${MAX_IMAGENES} imágenes`);
      return;
    }

    setError("");
    const nuevasPreviews = nuevosArchivos.map((archivo) =>
      URL.createObjectURL(archivo),
    );

    setArchivos((prev) => [...prev, ...nuevosArchivos]);
    setPreviews((prev) => [...prev, ...nuevasPreviews]);

    e.target.value = "";
  }

  function quitarImagen(index: number) {
    URL.revokeObjectURL(previews[index]);
    setArchivos((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (archivos.length === 0) {
      setError("Agrega al menos una imagen del promocional");
      return;
    }

    setCargando(true);

    try {
      const formData = new FormData();
      formData.append("nombre", nombre);
      formData.append("precio", precio);
      formData.append("categoria", categoria);
      formData.append("descripcion", descripcion);
      archivos.forEach((archivo) => formData.append("imagenes", archivo));

      const nuevo = await crearPromocional(formData);
      navigate(`/promocional/${nuevo._id}`);
    } catch (err) {
      const mensaje =
        (axios.isAxiosError(err) && err.response?.data?.message) ||
        "Error al publicar el promocional";
      setError(mensaje);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="registrar-producto-container">
      <form className="registrar-producto-card" onSubmit={handleSubmit}>
        <h2>Publicar nuevo promocional</h2>

        <p className="registrar-promocional-aviso">
          Los promocionales <strong>no se venden dentro de la plataforma</strong>
          : solo se anuncian y la compra se coordina directamente con el
          vendedor.
        </p>

        {error && <p className="registrar-producto-error">{error}</p>}

        <div className="form-group">
          <label>Nombre</label>
          <input
            type="text"
            className="registrar-producto-input"
            placeholder="Ej. Casa en venta con jardín"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label>Precio de referencia (MXN)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            className="registrar-producto-input"
            placeholder="0.00"
            value={precio}
            onChange={(e) => setPrecio(e.target.value)}
            required
          />
          <small className="registrar-producto-nota">
            El precio es solo de referencia: el pago se acuerda fuera de ICHIBA.
          </small>
        </div>

        <div className="form-group">
          <label>Tipo de promocional</label>
          <select
            className="registrar-producto-input"
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
          >
            {TIPOS_PROMOCIONAL.map((tipo) => (
              <option key={tipo.valor} value={tipo.valor}>
                {tipo.texto}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Descripción</label>
          <textarea
            className="registrar-producto-input registrar-producto-textarea"
            placeholder="Describe el artículo o servicio, detalles de ubicación, estado, etc."
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label>Imágenes del promocional (máximo {MAX_IMAGENES})</label>

          <label className="registrar-producto-dropzone">
            <input
              type="file"
              accept="image/png, image/jpeg, image/webp"
              multiple
              onChange={handleSeleccionArchivos}
              hidden
            />
             Haz clic para seleccionar imágenes
          </label>

          {previews.length > 0 && (
            <div className="registrar-producto-preview">
              {previews.map((url, index) => (
                <div key={index} className="registrar-producto-preview-item">
                  <img src={url} alt={`Imagen ${index + 1}`} />
                  <button type="button" onClick={() => quitarImagen(index)}>
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <Boton
          texto={cargando ? "Publicando..." : "Publicar promocional"}
          onClick={() => {}}
          type="submit"
        />
      </form>
    </div>
  );
}

export default RegistrarPromocional;
