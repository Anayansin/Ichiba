import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  editarPublicacionAdmin,
  fetchPublicacionesAdmin,
  type Paginado,
  type PublicacionAdmin,
} from "../../services/adminTotalService";
import { URL_BACKEND } from "../../services/api";
import {
  CATEGORIAS_PRODUCTO_CON_TEXTO,
  TIPOS_PROMOCIONAL,
  textoCategoria,
  textoPromocional,
} from "../../configuracion/categorias";
import { mensajeDeError } from "../../utils/errores";
import { Paginacion, dinero, formatearFecha } from "./AdminComunes";

function ModalEditarPublicacion({
  publicacion,
  onCerrar,
  onGuardada,
}: {
  publicacion: PublicacionAdmin;
  onCerrar: () => void;
  onGuardada: (mensaje: string) => void;
}) {
  const [nombre, setNombre] = useState(publicacion.nombre);
  const [descripcion, setDescripcion] = useState(publicacion.descripcion);
  const [precio, setPrecio] = useState(String(publicacion.precio));
  const [categoria, setCategoria] = useState(publicacion.categoria);
  const [activo, setActivo] = useState(publicacion.activo);
  const [chat, setChat] = useState(publicacion.chatHabilitado ?? true);
  const [comentarios, setComentarios] = useState(
    publicacion.zonaComentariosHabilitada ?? true,
  );
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const esPromocional = publicacion.tipo === "promocional";
  const categorias = esPromocional
    ? TIPOS_PROMOCIONAL.map((t) => ({ valor: t.valor, texto: t.texto }))
    : CATEGORIAS_PRODUCTO_CON_TEXTO;

  async function guardar(evento: FormEvent) {
    evento.preventDefault();
    setGuardando(true);
    setError("");
    try {
      const respuesta = await editarPublicacionAdmin(
        publicacion.tipo,
        publicacion._id,
        {
          nombre,
          descripcion,
          precio: Number(precio),
          categoria,
          activo,
          ...(esPromocional
            ? { chatHabilitado: chat, zonaComentariosHabilitada: comentarios }
            : {}),
        },
      );
      onGuardada(respuesta.message);
    } catch (err) {
      setError(mensajeDeError(err) || "No se pudo guardar la publicación");
      setGuardando(false);
    }
  }

  return (
    <div className="admin-t__fondo" onClick={onCerrar}>
      <form
        className="admin-t__modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        onSubmit={guardar}
      >
        <div className="admin-t__modal-cabecera">
          <div>
            <h3>Editar {esPromocional ? "promocional" : "producto"}</h3>
            <p>
              {publicacion.vendedor} · creado {formatearFecha(publicacion.creadoEn)}
            </p>
          </div>
          <button
            type="button"
            className="admin-t__cerrar"
            onClick={onCerrar}
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>
        <div className="admin-t__modal-cuerpo">
          {error && <p className="admin-t__error">{error}</p>}
          <div className="admin-t__form">
            <label className="admin-t__ancho">
              Nombre
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} />
            </label>
            <label>
              Precio (MXN)
              <input
                type="number"
                min="1"
                step="0.01"
                value={precio}
                onChange={(e) => setPrecio(e.target.value)}
              />
            </label>
            <label>
              Categoría
              <select
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
              >
                {categorias.map((c) => (
                  <option key={c.valor} value={c.valor}>
                    {c.texto}
                  </option>
                ))}
              </select>
            </label>
            <label className="admin-t__ancho">
              Descripción
              <textarea
                rows={5}
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
              />
            </label>
            <label className="admin-t__check">
              <input
                type="checkbox"
                checked={activo}
                onChange={(e) => setActivo(e.target.checked)}
              />
              Publicación activa
            </label>
            {esPromocional && (
              <>
                <label className="admin-t__check">
                  <input
                    type="checkbox"
                    checked={chat}
                    onChange={(e) => setChat(e.target.checked)}
                  />
                  Chat de consulta habilitado
                </label>
                <label className="admin-t__check">
                  <input
                    type="checkbox"
                    checked={comentarios}
                    onChange={(e) => setComentarios(e.target.checked)}
                  />
                  Comentarios habilitados
                </label>
              </>
            )}
          </div>
        </div>
        <div className="admin-t__modal-pie">
          <button
            type="button"
            className="admin-t__boton admin-t__boton--secundario"
            onClick={onCerrar}
          >
            Cancelar
          </button>
          <button type="submit" className="admin-t__boton" disabled={guardando}>
            {guardando ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </form>
    </div>
  );
}

function AdminPublicaciones() {
  const [busqueda, setBusqueda] = useState("");
  const [filtros, setFiltros] = useState({
    q: "",
    tipo: "todos",
    estado: "",
    pagina: 1,
  });
  const [recarga, setRecarga] = useState(0);
  const [datos, setDatos] = useState<Paginado<PublicacionAdmin> | null>(null);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [editando, setEditando] = useState<PublicacionAdmin | null>(null);
  const [cambiando, setCambiando] = useState<string | null>(null);

  useEffect(() => {
    fetchPublicacionesAdmin({
      q: filtros.q || undefined,
      tipo: filtros.tipo,
      estado: filtros.estado || undefined,
      pagina: filtros.pagina,
    })
      .then((respuesta) => {
        setDatos(respuesta);
        setError("");
      })
      .catch((err) =>
        setError(mensajeDeError(err) || "No se pudieron cargar las publicaciones"),
      );
  }, [filtros, recarga]);

  function buscar(evento: FormEvent) {
    evento.preventDefault();
    setFiltros((f) => ({ ...f, q: busqueda.trim(), pagina: 1 }));
  }

  async function alternarActivo(p: PublicacionAdmin) {
    setCambiando(p._id);
    setAviso("");
    try {
      await editarPublicacionAdmin(p.tipo, p._id, { activo: !p.activo });
      setAviso(p.activo ? "Publicación desactivada" : "Publicación activada");
      setRecarga((n) => n + 1);
    } catch (err) {
      setError(mensajeDeError(err) || "No se pudo cambiar la publicación");
    } finally {
      setCambiando(null);
    }
  }

  return (
    <div className="admin-t">
      <h2>Productos y promocionales</h2>

      <form className="admin-t__barra" onSubmit={buscar}>
        <input
          type="search"
          placeholder="Nombre, vendedor, categoría o ID"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          aria-label="Buscar publicaciones"
        />
        <select
          value={filtros.tipo}
          onChange={(e) =>
            setFiltros((f) => ({ ...f, tipo: e.target.value, pagina: 1 }))
          }
          aria-label="Tipo"
        >
          <option value="todos">Productos y promocionales</option>
          <option value="producto">Solo productos</option>
          <option value="promocional">Solo promocionales</option>
        </select>
        <select
          value={filtros.estado}
          onChange={(e) =>
            setFiltros((f) => ({ ...f, estado: e.target.value, pagina: 1 }))
          }
          aria-label="Estado"
        >
          <option value="">Activas e inactivas</option>
          <option value="activo">Activas</option>
          <option value="inactivo">Inactivas</option>
        </select>
        <button type="submit" className="admin-t__boton">
          Buscar
        </button>
      </form>

      {error && <p className="admin-t__error">{error}</p>}
      {aviso && <p className="admin-t__aviso">{aviso}</p>}
      {datos && (
        <span className="admin-t__total">
          {datos.total} publicaci{datos.total === 1 ? "ón" : "ones"}
        </span>
      )}

      {datos?.elementos.length === 0 ? (
        <p className="admin-t__vacio">No hay publicaciones con esos filtros.</p>
      ) : (
        <div className="admin-t__lista">
          {datos?.elementos.map((p) => (
            <div key={p._id} className="admin-t__fila">
              <div className="admin-t__producto">
                {p.imagenes[0] && (
                  <img
                    className="admin-t__miniatura"
                    src={`${URL_BACKEND}${p.imagenes[0]}`}
                    alt=""
                  />
                )}
                <div>
                  <p className="admin-t__fila-titulo">
                    <Link
                      to={
                        p.tipo === "producto"
                          ? `/producto/${p._id}`
                          : `/promocional/${p._id}`
                      }
                    >
                      {p.nombre}
                    </Link>{" "}
                    · {dinero.format(p.precio)}
                  </p>
                  <p className="admin-t__fila-sub">
                    {p.vendedor} ·{" "}
                    {p.tipo === "producto"
                      ? textoCategoria(p.categoria)
                      : textoPromocional(p.categoria)}{" "}
                    · {formatearFecha(p.creadoEn)}
                  </p>
                  <div className="admin-t__etiquetas">
                    <span className="admin-t__etiqueta">
                      {p.tipo === "producto" ? "Producto" : "Promocional"}
                    </span>
                    <span
                      className={`admin-t__etiqueta ${
                        p.activo ? "admin-t__etiqueta--verde" : "admin-t__etiqueta--roja"
                      }`}
                    >
                      {p.activo ? "Activa" : "Inactiva"}
                    </span>
                  </div>
                </div>
              </div>
              <div className="admin-t__fila-acciones">
                <button
                  type="button"
                  className="admin-t__boton admin-t__boton--secundario"
                  disabled={cambiando === p._id}
                  onClick={() => alternarActivo(p)}
                >
                  {p.activo ? "Desactivar" : "Activar"}
                </button>
                <button
                  type="button"
                  className="admin-t__boton"
                  onClick={() => setEditando(p)}
                >
                  Editar
                </button>
              </div>
              <p className="admin-t__fila-texto">{p.descripcion}</p>
            </div>
          ))}
        </div>
      )}

      {datos && (
        <Paginacion
          pagina={datos.pagina}
          totalPaginas={datos.totalPaginas}
          onCambiar={(pagina) => setFiltros((f) => ({ ...f, pagina }))}
        />
      )}

      {editando && (
        <ModalEditarPublicacion
          publicacion={editando}
          onCerrar={() => setEditando(null)}
          onGuardada={(mensaje) => {
            setEditando(null);
            setAviso(mensaje);
            setRecarga((n) => n + 1);
          }}
        />
      )}
    </div>
  );
}

export default AdminPublicaciones;
