import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import Boton from "../../components/Boton/Boton";
import { crearPromocional } from "../../services/promocionalService";
import { useAuth } from "../../context/AuthContext";
import { mensajeDeError } from "../../utils/errores";
import { CONDICIONES_USO } from "../../utils/opcionesProducto";
import { TIPOS_PROMOCIONAL } from "../../configuracion/categorias";
import "../RegistrarProducto/RegistrarProducto.css";
import "./RegistrarPromocional.css";

const MAX_IMAGENES = 6;
const PRECIO_MINIMO = 5001;

function RegistrarPromocional() {
  const { usuario } = useAuth();
  const navigate = useNavigate();

  const [nombre, setNombre] = useState("");
  const [precio, setPrecio] = useState("");
  const [categoria, setCategoria] = useState(TIPOS_PROMOCIONAL[0].valor);
  const [descripcion, setDescripcion] = useState("");
  const [condicionUso, setCondicionUso] = useState(CONDICIONES_USO[0].valor);
  const [coberturaEnvio, setCoberturaEnvio] = useState("");
  const [chatHabilitado, setChatHabilitado] = useState(true);
  const [zonaComentariosHabilitada, setZonaComentariosHabilitada] =
    useState(true);
  const [archivos, setArchivos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  const longitudNombre = nombre.length;
  const longitudDescripcion = descripcion.length;
  const nombreValido = longitudNombre >= 10 && longitudNombre <= 35;
  const descripcionValido =
    longitudDescripcion >= 30 && longitudDescripcion <= 100;

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

    if (!nombreValido) {
      setError("El nombre del promocional debe tener entre 10 y 35 caracteres");
      return;
    }

    if (!descripcionValido) {
      setError(
        "La descripción del promocional debe tener entre 30 y 100 caracteres",
      );
      return;
    }

    const precioNumerico = Number(precio);
    if (!Number.isFinite(precioNumerico) || precioNumerico < PRECIO_MINIMO) {
      setError("El precio del promocional debe ser mayor a $5,000");
      return;
    }

    if (coberturaEnvio.trim() === "") {
      setError("Indica la cobertura de envío del promocional");
      return;
    }

    setCargando(true);

    try {
      const formData = new FormData();
      formData.append("nombre", nombre);
      formData.append("precio", precio);
      formData.append("categoria", categoria);
      formData.append("descripcion", descripcion);
      formData.append("condicionUso", condicionUso);
      formData.append("coberturaEnvio", coberturaEnvio);
      formData.append("chatHabilitado", String(chatHabilitado));
      formData.append(
        "zonaComentariosHabilitada",
        String(zonaComentariosHabilitada),
      );
      archivos.forEach((archivo) => formData.append("imagenes", archivo));

      const nuevo = await crearPromocional(formData);
      navigate(`/promocional/${nuevo._id}`);
    } catch (err) {
      const mensaje =
        mensajeDeError(err) || "Error al publicar el promocional";
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
          <label>Nombre del promocional</label>
          <input
            type="text"
            className="registrar-producto-input"
            placeholder="Ej. Casa en venta con jardín"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
          />
          <small className="registrar-producto-nota">
            {longitudNombre}/35 caracteres
          </small>
        </div>

        <div className="form-group">
          <label>Precio de referencia (MXN)</label>
          <input
            type="number"
            min={PRECIO_MINIMO}
            step="0.01"
            className="registrar-producto-input"
            placeholder="0.00"
            value={precio}
            onChange={(e) => setPrecio(e.target.value)}
            required
          />
          <small className="registrar-producto-nota">
            El precio mínimo es $5,001 y no hay precio máximo. El pago se
            acuerda fuera de ICHIBA.
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
          <small className="registrar-producto-nota">
            {longitudDescripcion}/100 caracteres
          </small>
        </div>

        <div className="form-group">
          <label>Condición de uso</label>
          <select
            className="registrar-producto-input"
            value={condicionUso}
            onChange={(e) => setCondicionUso(e.target.value)}
          >
            {CONDICIONES_USO.map((opcion) => (
              <option key={opcion.valor} value={opcion.valor}>
                {opcion.texto}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Cobertura de envío</label>
          <input
            type="text"
            className="registrar-producto-input"
            placeholder="Ej. Todo el país, solo CDMX y Estado de México"
            value={coberturaEnvio}
            onChange={(e) => setCoberturaEnvio(e.target.value)}
            required
          />
          <small className="registrar-producto-nota">
            Escribe libremente hasta dónde llegas con el envío.
          </small>
        </div>

        <div className="form-group">
          <label htmlFor="chat-habilitado">Chat con compradores</label>
          <label className="registrar-promocional-switch">
            <input
              id="chat-habilitado"
              type="checkbox"
              checked={chatHabilitado}
              onChange={(e) => setChatHabilitado(e.target.checked)}
            />
            <span className="registrar-promocional-switch__pista" />
            <span className="registrar-promocional-switch__texto">
              {chatHabilitado ? "Chat habilitado" : "Chat deshabilitado"}
            </span>
          </label>
          <small className="registrar-producto-nota">
            Si lo desactivas, los compradores no podrán escribirte por chat.
          </small>
        </div>

        <div className="form-group">
          <label htmlFor="zona-comentarios-habilitada">
            Zona de comentarios
          </label>
          <label className="registrar-promocional-switch">
            <input
              id="zona-comentarios-habilitada"
              type="checkbox"
              checked={zonaComentariosHabilitada}
              onChange={(e) =>
                setZonaComentariosHabilitada(e.target.checked)
              }
            />
            <span className="registrar-promocional-switch__pista" />
            <span className="registrar-promocional-switch__texto">
              {zonaComentariosHabilitada
                ? "Comentarios habilitados"
                : "Comentarios deshabilitados"}
            </span>
          </label>
          <small className="registrar-producto-nota">
            Si la desactivas, nadie podrá comentar en tu anuncio.
          </small>
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
          disabled={cargando || !nombreValido || !descripcionValido}
        />
      </form>
    </div>
  );
}

export default RegistrarPromocional;
