import { useState, useEffect } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import Boton from "../../components/Boton/Boton";
import {
  fetchProductoPorId,
  actualizarProducto,
  type Producto,
} from "../../services/productoService";
import { useAuth } from "../../context/AuthContext";
import { URL_BACKEND } from "../../services/api";
import {
  CONDICIONES_PRODUCTO,
  METODOS_ENTREGA,
  TIEMPOS_LIMITE_PAGO,
  textoTiempoPago,
} from "../../utils/opcionesProducto";
import "./EditarProducto.css";

const categorias = [
  "Artesanias",
  "Ropa",
  "Hogar",
  "Electrodomesticos",
  "Coleccionables",
  "Otros",
];
const MAX_IMAGENES = 6;

function EditarProducto() {
  const { id } = useParams();
  const { usuario } = useAuth();
  const navigate = useNavigate();

  const [producto, setProducto] = useState<Producto | null>(null);
  const [cargandoProducto, setCargandoProducto] = useState(true);

  const [nombre, setNombre] = useState("");
  const [precio, setPrecio] = useState("");
  const [categoria, setCategoria] = useState(categorias[0]);
  const [descripcion, setDescripcion] = useState("");
  const [condicion, setCondicion] = useState(CONDICIONES_PRODUCTO[0].valor);
  const [metodoEntrega, setMetodoEntrega] = useState(METODOS_ENTREGA[0].valor);
  const [horarioInicio, setHorarioInicio] = useState("09:00");
  const [horarioFin, setHorarioFin] = useState("18:00");
  const [tiempoLimitePago, setTiempoLimitePago] = useState("60");

  const [imagenesExistentes, setImagenesExistentes] = useState<string[]>([]);
  const [archivosNuevos, setArchivosNuevos] = useState<File[]>([]);
  const [previewsNuevas, setPreviewsNuevas] = useState<string[]>([]);

  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetchProductoPorId(id)
      .then((data) => {
        setProducto(data);
        setNombre(data.nombre);
        setPrecio(String(data.precio));
        setCategoria(data.categoria);
        setDescripcion(data.descripcion);
        setCondicion(data.condicion ?? CONDICIONES_PRODUCTO[0].valor);
        setMetodoEntrega(data.metodoEntrega ?? METODOS_ENTREGA[0].valor);
        setHorarioInicio(data.horarioEntrega?.inicio ?? "09:00");
        setHorarioFin(data.horarioEntrega?.fin ?? "18:00");
        setTiempoLimitePago(String(data.tiempoLimitePago ?? 60));
        setImagenesExistentes(data.imagenes);
      })
      .catch(() => setError("No se pudo cargar el producto"))
      .finally(() => setCargandoProducto(false));
  }, [id]);

  if (!usuario) return <Navigate to="/" replace />;
  if (cargandoProducto)
    return <p className="editar-producto__cargando">Cargando producto...</p>;
  if (!producto)
    return <p className="editar-producto__cargando">Producto no encontrado</p>;
  if (producto.vendedorId !== usuario.id)
    return <Navigate to="/panel-vendedor" replace />;

  const totalImagenes = imagenesExistentes.length + archivosNuevos.length;

  function quitarImagenExistente(ruta: string) {
    setImagenesExistentes((prev) => prev.filter((img) => img !== ruta));
  }

  function quitarImagenNueva(index: number) {
    URL.revokeObjectURL(previewsNuevas[index]);
    setArchivosNuevos((prev) => prev.filter((_, i) => i !== index));
    setPreviewsNuevas((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSeleccionArchivos(e: React.ChangeEvent<HTMLInputElement>) {
    const nuevosArchivos = Array.from(e.target.files || []);

    if (totalImagenes + nuevosArchivos.length > MAX_IMAGENES) {
      setError(`Puedes tener máximo ${MAX_IMAGENES} imágenes en total`);
      return;
    }

    setError("");
    const nuevasPreviews = nuevosArchivos.map((archivo) =>
      URL.createObjectURL(archivo),
    );
    setArchivosNuevos((prev) => [...prev, ...nuevosArchivos]);
    setPreviewsNuevas((prev) => [...prev, ...nuevasPreviews]);
    e.target.value = "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (totalImagenes === 0) {
      setError("El producto debe tener al menos una imagen");
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
      formData.append("imagenesExistentes", JSON.stringify(imagenesExistentes));
      archivosNuevos.forEach((archivo) => formData.append("imagenes", archivo));

      await actualizarProducto(id as string, formData);
      navigate(`/producto/${id}`);
    } catch (err: any) {
      setError(
        err.response?.data?.message || "Error al actualizar el producto",
      );
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="editar-producto-container">
      <form className="editar-producto-card" onSubmit={handleSubmit}>
        <h2>Editar producto</h2>

        {error && <p className="editar-producto-error">{error}</p>}

        <div className="form-group">
          <label>Nombre del producto</label>
          <input
            type="text"
            className="editar-producto-input"
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
            className="editar-producto-input"
            value={precio}
            onChange={(e) => setPrecio(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label>Categoría</label>
          <select
            className="editar-producto-input"
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
            className="editar-producto-input editar-producto-textarea"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label>Condiciones de uso</label>
          <select
            className="editar-producto-input"
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
            className="editar-producto-input"
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
          <div className="editar-producto-horario">
            <input
              type="time"
              className="editar-producto-input"
              value={horarioInicio}
              onChange={(e) => setHorarioInicio(e.target.value)}
              required
            />
            <span>a</span>
            <input
              type="time"
              className="editar-producto-input"
              value={horarioFin}
              onChange={(e) => setHorarioFin(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="form-group">
          <label>Tiempo límite de pago</label>
          <select
            className="editar-producto-input"
            value={tiempoLimitePago}
            onChange={(e) => setTiempoLimitePago(e.target.value)}
          >
            {TIEMPOS_LIMITE_PAGO.map((minutos) => (
              <option key={minutos} value={minutos}>
                {textoTiempoPago(minutos)}
              </option>
            ))}
          </select>
          <small className="editar-producto-nota">
            El comprador en posición 1 de la fila tiene entre 30 minutos y 3
            horas para pagar.
          </small>
        </div>

        <div className="form-group">
          <label>
            Imágenes ({totalImagenes}/{MAX_IMAGENES})
          </label>

          <div className="editar-producto-preview">
            {imagenesExistentes.map((img) => (
              <div key={img} className="editar-producto-preview-item">
                <img src={`${URL_BACKEND}${img}`} alt="Imagen del producto" />
                <button
                  type="button"
                  onClick={() => quitarImagenExistente(img)}
                >
                  ✕
                </button>
              </div>
            ))}
            {previewsNuevas.map((url, index) => (
              <div key={url} className="editar-producto-preview-item">
                <img src={url} alt="Nueva imagen" />
                <button type="button" onClick={() => quitarImagenNueva(index)}>
                  ✕
                </button>
              </div>
            ))}
          </div>

          {totalImagenes < MAX_IMAGENES && (
            <label className="editar-producto-dropzone">
              <input
                type="file"
                accept="image/png, image/jpeg, image/webp"
                multiple
                onChange={handleSeleccionArchivos}
                hidden
              />
              Agregar más imágenes
            </label>
          )}
        </div>

        <Boton
          texto={cargando ? "Guardando..." : "Guardar cambios"}
          onClick={() => {}}
          type="submit"
        />
      </form>
    </div>
  );
}

export default EditarProducto;
