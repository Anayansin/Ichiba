import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  fetchConversacionesAdmin,
  type ConversacionAdmin,
  type Paginado,
  type TipoConversacion,
} from "../../services/adminTotalService";
import { mensajeDeError } from "../../utils/errores";
import {
  ModalConversacionAdmin,
  Paginacion,
  formatearFecha,
} from "./AdminComunes";

const TEXTO_TIPO: Record<TipoConversacion, string> = {
  venta: "Chat de venta",
  consulta: "Consulta de promocional",
  comentarios: "Comentarios",
};

function AdminConversaciones() {
  const [busqueda, setBusqueda] = useState("");
  const [filtros, setFiltros] = useState({
    q: "",
    tipo: "todas",
    problema: false,
    pagina: 1,
  });
  const [datos, setDatos] = useState<Paginado<ConversacionAdmin> | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [abierta, setAbierta] = useState<ConversacionAdmin | null>(null);

  useEffect(() => {
    setCargando(true);
    fetchConversacionesAdmin({
      q: filtros.q || undefined,
      tipo: filtros.tipo,
      problema: filtros.problema ? "1" : undefined,
      pagina: filtros.pagina,
    })
      .then((respuesta) => {
        setDatos(respuesta);
        setError("");
      })
      .catch((err) =>
        setError(mensajeDeError(err) || "No se pudieron cargar las conversaciones"),
      )
      .finally(() => setCargando(false));
  }, [filtros]);

  function buscar(evento: FormEvent) {
    evento.preventDefault();
    setFiltros((f) => ({ ...f, q: busqueda.trim(), pagina: 1 }));
  }

  return (
    <div className="admin-t">
      <h2>Conversaciones</h2>

      <form className="admin-t__barra" onSubmit={buscar}>
        <input
          type="search"
          placeholder="Producto, persona, n.º de venta o texto de un mensaje"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          aria-label="Buscar conversaciones"
        />
        <select
          value={filtros.tipo}
          onChange={(e) =>
            setFiltros((f) => ({ ...f, tipo: e.target.value, pagina: 1 }))
          }
          aria-label="Tipo de conversación"
        >
          <option value="todas">Todas</option>
          <option value="venta">Chats de venta</option>
          <option value="consulta">Consultas de promocionales</option>
          <option value="comentarios">Comentarios</option>
        </select>
        <label className="admin-t__check">
          <input
            type="checkbox"
            checked={filtros.problema}
            onChange={(e) =>
              setFiltros((f) => ({ ...f, problema: e.target.checked, pagina: 1 }))
            }
          />
          Con disputa o reporte
        </label>
        <button type="submit" className="admin-t__boton">
          Buscar
        </button>
      </form>

      {error && <p className="admin-t__error">{error}</p>}
      {datos && (
        <span className="admin-t__total">
          {datos.total} conversación{datos.total === 1 ? "" : "es"}
        </span>
      )}

      {cargando && !datos ? (
        <p className="admin-t__cargando">Cargando...</p>
      ) : datos?.elementos.length === 0 ? (
        <p className="admin-t__vacio">No hay conversaciones con esos filtros.</p>
      ) : (
        <div className="admin-t__lista">
          {datos?.elementos.map((c) => {
            const conProblema = Boolean(c.disputa) || c.reportes > 0 || c.retenido;
            return (
              <div
                key={`${c.tipo}:${c.id}`}
                className={`admin-t__fila ${conProblema ? "admin-t__fila--alerta" : ""}`}
              >
                <div>
                  <p className="admin-t__fila-titulo">{c.titulo}</p>
                  <p className="admin-t__fila-sub">
                    {c.participantes} · {formatearFecha(c.ultimaFecha)}
                  </p>
                  <div className="admin-t__etiquetas">
                    <span className="admin-t__etiqueta">{TEXTO_TIPO[c.tipo]}</span>
                    <span className="admin-t__etiqueta">
                      {c.totalMensajes} mensaje{c.totalMensajes === 1 ? "" : "s"}
                    </span>
                    {c.disputa && (
                      <span className="admin-t__etiqueta admin-t__etiqueta--roja">
                        Disputa {c.disputa}
                      </span>
                    )}
                    {c.reportes > 0 && (
                      <span className="admin-t__etiqueta admin-t__etiqueta--roja">
                        {c.reportes} reporte{c.reportes === 1 ? "" : "s"}
                      </span>
                    )}
                    {c.retenido && (
                      <span className="admin-t__etiqueta admin-t__etiqueta--amarilla">
                        Pago retenido
                      </span>
                    )}
                  </div>
                </div>
                <div className="admin-t__fila-acciones">
                  <button
                    type="button"
                    className="admin-t__boton"
                    onClick={() => setAbierta(c)}
                  >
                    Ver conversación
                  </button>
                </div>
                {c.vistaPrevia && (
                  <p className="admin-t__fila-texto">{c.vistaPrevia}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {datos && (
        <Paginacion
          pagina={datos.pagina}
          totalPaginas={datos.totalPaginas}
          onCambiar={(pagina) => setFiltros((f) => ({ ...f, pagina }))}
        />
      )}

      {abierta && (
        <ModalConversacionAdmin
          tipo={abierta.tipo}
          id={abierta.id}
          onCerrar={() => setAbierta(null)}
        />
      )}
    </div>
  );
}

export default AdminConversaciones;
