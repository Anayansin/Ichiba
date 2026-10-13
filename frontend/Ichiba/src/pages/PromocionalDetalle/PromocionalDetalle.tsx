import { useParams, useNavigate, Link } from "react-router-dom";
import { useState, useEffect } from "react";
import Carrusel from "../../components/Carrusel/Carrusel";
import {
  fetchPromocionalPorId,
  fetchComentarios,
  crearComentario,
  type Promocional,
  type Comentario,
} from "../../services/promocionalService";
import { textoPromocional } from "../../configuracion/categorias";
import { useAuth } from "../../context/AuthContext";
import { mensajeDeError } from "../../utils/errores";
import "./PromocionalDetalle.css";

const MAX_CARACTERES = 500;

function PromocionalDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { usuario } = useAuth();

  const [promocional, setPromocional] = useState<Promocional | null>(null);
  const [cargando, setCargando] = useState(true);

  const [comentarios, setComentarios] = useState<Comentario[]>([]);
  const [textoComentario, setTextoComentario] = useState("");
  const [nombreAutor, setNombreAutor] = useState("");
  const [enviandoComentario, setEnviandoComentario] = useState(false);
  const [errorComentario, setErrorComentario] = useState("");
  const [avisoComentario, setAvisoComentario] = useState("");

  useEffect(() => {
    if (!id) return;
    fetchPromocionalPorId(id)
      .then((data) => setPromocional(data))
      .catch((error) => console.error("Error al cargar promocional:", error))
      .finally(() => setCargando(false));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    fetchComentarios(id)
      .then((data) => setComentarios(data))
      .catch((error) => console.error("Error al cargar comentarios:", error));
  }, [id]);

  if (cargando) return <p>Cargando promocional...</p>;
  if (!promocional)
    return <p className="promocional-detalle__no-encontrado">Promocional no encontrado</p>;

  const esDueno = String(usuario?.id) === String(promocional.vendedorId);

  if (!promocional.activo && !esDueno) {
    return (
      <p className="promocional-detalle__no-encontrado">
        Este promocional ya no está disponible
      </p>
    );
  }

  async function manejarComentario(e: React.FormEvent) {
    e.preventDefault();
    if (!promocional) return;

    setErrorComentario("");
    setAvisoComentario("");

    const texto = textoComentario.trim();
    if (!texto) {
      setErrorComentario("Escribe tu comentario antes de enviarlo");
      return;
    }
    if (texto.length > MAX_CARACTERES) {
      setErrorComentario(
        `Tu comentario no puede superar los ${MAX_CARACTERES} caracteres`,
      );
      return;
    }

    setEnviandoComentario(true);
    try {
      const comentario = await crearComentario(
        promocional._id,
        texto,
        nombreAutor.trim(),
      );
      setComentarios((anteriores) => [...anteriores, comentario]);
      setTextoComentario("");
      setAvisoComentario("Comentario publicado");
    } catch (err) {
      setErrorComentario(
        mensajeDeError(err) || "No se pudo publicar tu comentario",
      );
    } finally {
      setEnviandoComentario(false);
    }
  }

  return (
    <div className="promocional-detalle">
      <button
        className="promocional-detalle__volver"
        onClick={() => navigate(-1)}
      >
        ← Volver
      </button>

      <div className="promocional-detalle__imagen-wrapper">
        <Carrusel
          imagenes={promocional.imagenes}
          alt={promocional.nombre}
        />
      </div>

      <div className="promocional-detalle__info">
        <span className="promocional-detalle__categoria">
          Promocional · {textoPromocional(promocional.categoria)}
        </span>
        <h1 className="promocional-detalle__nombre">
          {promocional.nombre}
        </h1>
        <p className="promocional-detalle__precio">
          ${promocional.precio}
        </p>

        {!promocional.activo && esDueno && (
          <p className="promocional-detalle__aviso-inactivo">
            Este promocional está desactivado — solo tú puedes verlo así
          </p>
        )}

        <div className="promocional-detalle__aviso">
          <h3>Este artículo no se vende en la plataforma</h3>
          <p>
            ICHIBA solo lo anuncia. La compra, el precio final y la entrega se
            coordinan <strong>directamente con el vendedor</strong>, fuera de la
            plataforma y sin pago a través de ICHIBA.
          </p>
        </div>

        <Link
          to={`/vendedor/${promocional.vendedorId}`}
          className="promocional-detalle__vendedor"
        >
          <div className="promocional-detalle__avatar" />
          <div>
            <p className="promocional-detalle__vendedor-label">Anunciado por</p>
            <p className="promocional-detalle__vendedor-nombre">
              {promocional.vendedor}
            </p>
          </div>
        </Link>

        <div className="promocional-detalle__descripcion">
          <h3>Descripción</h3>
          <p>{promocional.descripcion}</p>
        </div>

        <div className="promocional-detalle__comentarios">
          <h3>Comentarios ({comentarios.length})</h3>

          {promocional.zonaComentariosHabilitada === false ? (
            <p className="promocional-detalle__comentarios-aviso">
              Los comentarios están deshabilitados en esta publicación.
            </p>
          ) : (
            <>
              {comentarios.length === 0 ? (
                <p className="promocional-detalle__comentarios-vacio">
                  Sé el primero en comentar esta publicación.
                </p>
              ) : (
                <ul className="promocional-detalle__comentarios-lista">
                  {comentarios.map((comentario) => (
                    <li key={comentario._id}>
                      <div className="promocional-detalle__comentario-cabecera">
                        <strong>{comentario.autorNombre}</strong>
                        <span>
                          {new Date(comentario.createdAt).toLocaleDateString(
                            "es-MX",
                          )}
                        </span>
                      </div>
                      <p>{comentario.texto}</p>
                    </li>
                  ))}
                </ul>
              )}

              <form
                className="promocional-detalle__comentarios-form"
                onSubmit={manejarComentario}
              >
                {errorComentario && (
                  <p className="promocional-detalle__comentario-error">
                    {errorComentario}
                  </p>
                )}
                {avisoComentario && (
                  <p className="promocional-detalle__comentario-aviso">
                    {avisoComentario}
                  </p>
                )}

                <label htmlFor="comentario-nombre">Tu nombre (opcional)</label>
                <input
                  id="comentario-nombre"
                  type="text"
                  className="promocional-detalle__comentario-nombre"
                  placeholder="Visitante"
                  value={nombreAutor}
                  onChange={(e) => setNombreAutor(e.target.value)}
                  maxLength={50}
                />

                <label htmlFor="comentario-texto">Tu comentario</label>
                <textarea
                  id="comentario-texto"
                  className="promocional-detalle__comentario-texto"
                  placeholder="Escribe aquí tu comentario"
                  value={textoComentario}
                  onChange={(e) => setTextoComentario(e.target.value)}
                  maxLength={MAX_CARACTERES}
                  rows={3}
                />
                <span className="promocional-detalle__comentario-contador">
                  {textoComentario.length}/{MAX_CARACTERES}
                </span>

                <button
                  type="submit"
                  className="promocional-detalle__comentario-boton"
                  disabled={enviandoComentario}
                >
                  {enviandoComentario ? "Enviando..." : "Publicar comentario"}
                </button>
              </form>
            </>
          )}
        </div>

        <Link
          to="/promocionales"
          className="promocional-detalle__ver-mas"
        >
          Ver más promocionales
        </Link>
      </div>
    </div>
  );
}

export default PromocionalDetalle;
