import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  ASUNTOS_QUEJA,
  actualizarQuejaAdmin,
  fetchQuejasAdmin,
  fetchTodosLosReportesAdmin,
  type Paginado,
  type QuejaAdmin,
  type ReporteCompletoAdmin,
} from "../../services/adminTotalService";
import { nombreElementoReporte } from "../../configuracion/categoriasReporte";
import { mensajeDeError } from "../../utils/errores";
import { Paginacion, formatearFecha } from "./AdminComunes";

const TEXTO_ESTADO_QUEJA: Record<string, string> = {
  abierta: "Abierta",
  en_revision: "En revisión",
  atendida: "Atendida",
};

function nombreAsunto(id: string) {
  return ASUNTOS_QUEJA.find((a) => a.id === id)?.nombre ?? id;
}

function Quejas() {
  const [busqueda, setBusqueda] = useState("");
  const [filtros, setFiltros] = useState({ q: "", estado: "", pagina: 1 });
  const [recarga, setRecarga] = useState(0);
  const [datos, setDatos] = useState<
    (Paginado<QuejaAdmin> & { abiertas: number }) | null
  >(null);
  const [error, setError] = useState("");
  const [respuestas, setRespuestas] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState<string | null>(null);

  useEffect(() => {
    fetchQuejasAdmin({
      q: filtros.q || undefined,
      estado: filtros.estado || undefined,
      pagina: filtros.pagina,
    })
      .then((respuesta) => {
        setDatos(respuesta);
        setError("");
      })
      .catch((err) =>
        setError(mensajeDeError(err) || "No se pudieron cargar las quejas"),
      );
  }, [filtros, recarga]);

  async function actualizar(queja: QuejaAdmin, estado: string) {
    setGuardando(queja._id);
    try {
      await actualizarQuejaAdmin(queja._id, {
        estado,
        respuestaAdmin: respuestas[queja._id] ?? queja.respuestaAdmin,
      });
      setRecarga((n) => n + 1);
    } catch (err) {
      setError(mensajeDeError(err) || "No se pudo actualizar la queja");
    } finally {
      setGuardando(null);
    }
  }

  function buscar(evento: FormEvent) {
    evento.preventDefault();
    setFiltros((f) => ({ ...f, q: busqueda.trim(), pagina: 1 }));
  }

  return (
    <>
      <form className="admin-t__barra" onSubmit={buscar}>
        <input
          type="search"
          placeholder="Nombre, correo, tema o texto de la queja"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          aria-label="Buscar quejas"
        />
        <select
          value={filtros.estado}
          onChange={(e) =>
            setFiltros((f) => ({ ...f, estado: e.target.value, pagina: 1 }))
          }
          aria-label="Estado"
        >
          <option value="">Todos los estados</option>
          <option value="abierta">Abiertas</option>
          <option value="en_revision">En revisión</option>
          <option value="atendida">Atendidas</option>
        </select>
        <button type="submit" className="admin-t__boton">
          Buscar
        </button>
      </form>

      {error && <p className="admin-t__error">{error}</p>}
      {datos && (
        <span className="admin-t__total">
          {datos.total} queja{datos.total === 1 ? "" : "s"} · {datos.abiertas}{" "}
          sin atender
        </span>
      )}

      {datos?.elementos.length === 0 ? (
        <p className="admin-t__vacio">No hay quejas con esos filtros.</p>
      ) : (
        <div className="admin-t__lista">
          {datos?.elementos.map((q) => (
            <div
              key={q._id}
              className={`admin-t__fila ${q.estado !== "atendida" ? "admin-t__fila--alerta" : ""}`}
            >
              <div>
                <p className="admin-t__fila-titulo">{nombreAsunto(q.asunto)}</p>
                <p className="admin-t__fila-sub">
                  {q.nombre}
                  {q.correo && ` · ${q.correo}`} · {formatearFecha(q.creadaEn)}
                  {q.referencia && ` · Referencia: ${q.referencia}`}
                </p>
                <div className="admin-t__etiquetas">
                  <span
                    className={`admin-t__etiqueta ${
                      q.estado === "atendida"
                        ? "admin-t__etiqueta--verde"
                        : q.estado === "en_revision"
                          ? "admin-t__etiqueta--amarilla"
                          : "admin-t__etiqueta--roja"
                    }`}
                  >
                    {TEXTO_ESTADO_QUEJA[q.estado]}
                  </span>
                </div>
              </div>
              <div className="admin-t__fila-acciones">
                {q.estado === "abierta" && (
                  <button
                    type="button"
                    className="admin-t__boton admin-t__boton--secundario"
                    disabled={guardando === q._id}
                    onClick={() => actualizar(q, "en_revision")}
                  >
                    En revisión
                  </button>
                )}
                {q.estado !== "atendida" ? (
                  <button
                    type="button"
                    className="admin-t__boton"
                    disabled={guardando === q._id}
                    onClick={() => actualizar(q, "atendida")}
                  >
                    Marcar atendida
                  </button>
                ) : (
                  <button
                    type="button"
                    className="admin-t__boton admin-t__boton--secundario"
                    disabled={guardando === q._id}
                    onClick={() => actualizar(q, "abierta")}
                  >
                    Reabrir
                  </button>
                )}
              </div>
              <p className="admin-t__fila-texto">{q.mensaje}</p>
              <div className="admin-t__fila-texto admin-t__form">
                <label className="admin-t__ancho">
                  Nota de la administración
                  <textarea
                    rows={2}
                    value={respuestas[q._id] ?? q.respuestaAdmin}
                    onChange={(e) =>
                      setRespuestas((r) => ({ ...r, [q._id]: e.target.value }))
                    }
                  />
                </label>
              </div>
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
    </>
  );
}

function TodosLosReportes() {
  const [busqueda, setBusqueda] = useState("");
  const [filtros, setFiltros] = useState({ q: "", estado: "", pagina: 1 });
  const [datos, setDatos] = useState<Paginado<ReporteCompletoAdmin> | null>(
    null,
  );
  const [error, setError] = useState("");

  useEffect(() => {
    fetchTodosLosReportesAdmin({
      q: filtros.q || undefined,
      estado: filtros.estado || undefined,
      pagina: filtros.pagina,
    })
      .then((respuesta) => {
        setDatos(respuesta);
        setError("");
      })
      .catch((err) =>
        setError(mensajeDeError(err) || "No se pudieron cargar los reportes"),
      );
  }, [filtros]);

  return (
    <>
      <form
        className="admin-t__barra"
        onSubmit={(e) => {
          e.preventDefault();
          setFiltros((f) => ({ ...f, q: busqueda.trim(), pagina: 1 }));
        }}
      >
        <input
          type="search"
          placeholder="Persona, categoría o detalle"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          aria-label="Buscar reportes"
        />
        <select
          value={filtros.estado}
          onChange={(e) =>
            setFiltros((f) => ({ ...f, estado: e.target.value, pagina: 1 }))
          }
          aria-label="Estado"
        >
          <option value="">Todos los estados</option>
          <option value="pendiente">Pendientes</option>
          <option value="confirmado">Confirmados</option>
          <option value="rechazado">Rechazados</option>
        </select>
        <button type="submit" className="admin-t__boton">
          Buscar
        </button>
      </form>

      {error && <p className="admin-t__error">{error}</p>}
      {datos && (
        <span className="admin-t__total">
          {datos.total} reporte{datos.total === 1 ? "" : "s"}
        </span>
      )}

      {datos?.elementos.length === 0 ? (
        <p className="admin-t__vacio">No hay reportes con esos filtros.</p>
      ) : (
        <div className="admin-t__lista">
          {datos?.elementos.map((r) => (
            <div
              key={r.id}
              className={`admin-t__fila ${r.estado === "pendiente" ? "admin-t__fila--alerta" : ""}`}
            >
              <div>
                <p className="admin-t__fila-titulo">
                  {r.categoria} · {nombreElementoReporte(r.elemento)}
                </p>
                <p className="admin-t__fila-sub">
                  {r.reportadoPor} reportó a {r.reportado} ·{" "}
                  {formatearFecha(r.creadoEn)}
                  {r.ventaIdPg && ` · Venta ${r.ventaIdPg}`}
                </p>
                <div className="admin-t__etiquetas">
                  <span
                    className={`admin-t__etiqueta ${
                      r.estado === "confirmado"
                        ? "admin-t__etiqueta--verde"
                        : r.estado === "pendiente"
                          ? "admin-t__etiqueta--amarilla"
                          : ""
                    }`}
                  >
                    {r.estado}
                  </span>
                  <span className="admin-t__etiqueta">Falta {r.tipoFalta}</span>
                </div>
              </div>
              {r.detalle && (
                <p className="admin-t__fila-texto">
                  <strong>Detalle:</strong> {r.detalle}
                </p>
              )}
              {r.contenidoReportado && (
                <p className="admin-t__fila-texto">
                  <strong>Mensaje reportado:</strong> «{r.contenidoReportado}»
                </p>
              )}
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
    </>
  );
}

function AdminQuejas() {
  const [pestana, setPestana] = useState<"quejas" | "reportes">("quejas");
  return (
    <div className="admin-t">
      <h2>Quejas y reportes</h2>
      <div className="admin-t__pestanas" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={pestana === "quejas"}
          className={`admin-t__pestana ${pestana === "quejas" ? "admin-t__pestana--activa" : ""}`}
          onClick={() => setPestana("quejas")}
        >
          Quejas de usuarios
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={pestana === "reportes"}
          className={`admin-t__pestana ${pestana === "reportes" ? "admin-t__pestana--activa" : ""}`}
          onClick={() => setPestana("reportes")}
        >
          Todos los reportes
        </button>
      </div>
      {pestana === "quejas" ? <Quejas /> : <TodosLosReportes />}
    </div>
  );
}

export default AdminQuejas;
