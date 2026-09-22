import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import Boton from "../../components/Boton/Boton";
import { crearProducto } from "../../services/productoService";
import { useAuth } from "../../context/AuthContext";
import {
  CONDICIONES_PRODUCTO,
  METODOS_ENTREGA,
  TIEMPOS_LIMITE_PAGO,
  textoTiempoPago,
} from "../../utils/opcionesProducto";
import "./RegistrarProducto.css";

const categorias = [
  "Artesanias",
  "Ropa",
  "Hogar",
  "Electrodomesticos",
  "Coleccionables",
  "Otros",
];

const MAX_IMAGENES = 6;

function RegistrarProducto() {
  const { usuario } = useAuth();
  const navigate = useNavigate();

  const [nombre, setNombre] = useState("");
  const [precio, setPrecio] = useState("");
  const [categoria, setCategoria] = useState(categorias[0]);
  const [descripcion, setDescripcion] = useState("");
  const [condicion, setCondicion] = useState(CONDICIONES_PRODUCTO[0].valor);
  const [metodoEntrega, setMetodoEntrega] = useState(METODOS_ENTREGA[0].valor);
  const [horarioInicio, setHorarioInicio] = useState("09:00");
  const [horarioFin, setHorarioFin] = useState("18:00");
  const [tiempoLimitePago, setTiempoLimitePago] = useState("60");
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
      setError("Agrega al menos una imagen del producto");
      return;
    }

    if (horarioInicio >= horarioFin) {
      setError(
        "El horario de coordinación de entrega debe empezar antes de terminar",
      );
      return;
    }

    setCargando(true);

    try {
      const formData = new FormData();
      formData.append("nombre", nombre);
      formData.append("precio", precio);
      formData.append("categoria", categoria);
      formData.append("descripcion", descripcion);
      formData.append("condicion", condicion);
      formData.append("metodoEntrega", metodoEntrega);
      formData.append("horarioInicio", horarioInicio);
      formData.append("horarioFin", horarioFin);
      formData.append("tiempoLimitePago", tiempoLimitePago);
      archivos.forEach((archivo) => formData.append("imagenes", archivo));

      const nuevo = await crearProducto(formData);
      navigate(`/producto/${nuevo._id}`);
    } catch (err: any) {
      const mensaje =
        err.response?.data?.message || "Error al publicar el producto";
      setError(mensaje);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="registrar-producto-container">
      <form className="registrar-producto-card" onSubmit={handleSubmit}>
        <h2>Publicar nuevo producto</h2>

        {error && <p className="registrar-producto-error">{error}</p>}

        <div className="form-group">
          <label>Nombre del producto</label>
          <input
            type="text"
            className="registrar-producto-input"
            placeholder="Ej. Playera bordada a mano"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label>Precio (MXN)</label>
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
        </div>

        <div className="form-group">
          <label>Categoría</label>
          <select
            className="registrar-producto-input"
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
          >
            {categorias.map((cat) => (
              <option key={cat} value={cat.toLowerCase()}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Descripción</label>
          <textarea
            className="registrar-producto-input registrar-producto-textarea"
            placeholder="Describe el producto, materiales, tallas, etc."
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label>Condiciones de uso</label>
          <select
            className="registrar-producto-input"
            value={condicion}
            onChange={(e) => setCondicion(e.target.value)}
          >
            {CONDICIONES_PRODUCTO.map((opcion) => (
              <option key={opcion.valor} value={opcion.valor}>
                {opcion.texto}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Método de entrega</label>
          <select
            className="registrar-producto-input"
            value={metodoEntrega}
            onChange={(e) => setMetodoEntrega(e.target.value)}
          >
            {METODOS_ENTREGA.map((opcion) => (
              <option key={opcion.valor} value={opcion.valor}>
                {opcion.texto}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Horario de coordinación de entrega</label>
          <div className="registrar-producto-horario">
            <input
              type="time"
              className="registrar-producto-input"
              value={horarioInicio}
              onChange={(e) => setHorarioInicio(e.target.value)}
              required
            />
            <span>a</span>
            <input
              type="time"
              className="registrar-producto-input"
              value={horarioFin}
              onChange={(e) => setHorarioFin(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="form-group">
          <label>Tiempo límite de pago</label>
          <select
            className="registrar-producto-input"
            value={tiempoLimitePago}
            onChange={(e) => setTiempoLimitePago(e.target.value)}
          >
            {TIEMPOS_LIMITE_PAGO.map((minutos) => (
              <option key={minutos} value={minutos}>
                {textoTiempoPago(minutos)}
              </option>
            ))}
          </select>
          <small className="registrar-producto-nota">
            El comprador en posición 1 de la fila tiene entre 30 minutos y 3
            horas para pagar.
          </small>
        </div>

        <div className="form-group">
          <label>Imágenes del producto (máximo {MAX_IMAGENES})</label>

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
          texto={cargando ? "Publicando..." : "Publicar producto"}
          onClick={() => {}}
          type="submit"
        />
      </form>
    </div>
  );
}

export default RegistrarProducto;
