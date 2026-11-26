import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  fetchTransaccionesAdmin,
  type Paginado,
  type TransaccionAdmin,
} from "../../services/adminTotalService";
import { mensajeDeError } from "../../utils/errores";
import {
  ModalConversacionAdmin,
  Paginacion,
  dinero,
  formatearFecha,
} from "./AdminComunes";

const ESTADOS = [
  { id: "", nombre: "Todos los estados" },
  { id: "pendiente_comprobante", nombre: "Esperando comprobante" },
  { id: "pendiente_confirmacion", nombre: "Comprobante por confirmar" },
  { id: "en_entrega", nombre: "En entrega" },
  { id: "completada", nombre: "Completada" },
  { id: "reembolsada", nombre: "Reembolsada" },
  { id: "cancelada", nombre: "Cancelada" },
];

function claseEstado(estado: string): string {
  if (estado === "completada") return "admin-t__etiqueta--verde";
  if (estado === "reembolsada" || estado === "cancelada")
    return "admin-t__etiqueta--roja";
  return "admin-t__etiqueta--amarilla";
}

function AdminTransacciones() {
  const [busqueda, setBusqueda] = useState("");
  const [filtros, setFiltros] = useState({
    q: "",
    estado: "",
    problema: false,
    pagina: 1,
  });
  const [datos, setDatos] = useState<Paginado<TransaccionAdmin> | null>(null);
  const [error, setError] = useState("");
  const [conversacion, setConversacion] = useState<string | null>(null);

  useEffect(() => {
    fetchTransaccionesAdmin({
      q: filtros.q || undefined,
      estado: filtros.estado || undefined,
      problema: filtros.problema ? "1" : undefined,
      pagina: filtros.pagina,
    })
      .then((respuesta) => {
        setDatos(respuesta);
        setError("");
      })
      .catch((err) =>
        setError(mensajeDeError(err) || "No se pudieron cargar las transacciones"),
      );
  }, [filtros]);

  function buscar(evento: FormEvent) {
    evento.preventDefault();
    setFiltros((f) => ({ ...f, q: busqueda.trim(), pagina: 1 }));
  }

  return (
    <div className="admin-t">
      <h2>Transacciones</h2>

      <form className="admin-t__barra" onSubmit={buscar}>
        <input
          type="search"
          placeholder="Producto, vendedor, comprador, n.º de venta o motivo"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          aria-label="Buscar transacciones"
        />
        <select
          value={filtros.estado}
          onChange={(e) =>
            setFiltros((f) => ({ ...f, estado: e.target.value, pagina: 1 }))
          }
          aria-label="Estado"
        >
          {ESTADOS.map((estado) => (
            <option key={estado.id} value={estado.id}>
              {estado.nombre}
            </option>
          ))}
        </select>
        <label className="admin-t__check">
          <input
            type="checkbox"
            checked={filtros.problema}
            onChange={(e) =>
              setFiltros((f) => ({ ...f, problema: e.target.checked, pagina: 1 }))
            }
          />
          Con disputa, reporte o retención
        </label>
        <button type="submit" className="admin-t__boton">
          Buscar
        </button>
      </form>

      {error && <p className="admin-t__error">{error}</p>}
      {datos && (
        <span className="admin-t__total">
          {datos.total} transacci{datos.total === 1 ? "ón" : "ones"}
        </span>
      )}

      {datos?.elementos.length === 0 ? (
        <p className="admin-t__vacio">No hay transacciones con esos filtros.</p>
      ) : (
        <div className="admin-t__lista">
          {datos?.elementos.map((t) => (
            <div
              key={t._id}
              className={`admin-t__fila ${
                t.disputa || t.retenido || t.reportes > 0
                  ? "admin-t__fila--alerta"
                  : ""
              }`}
            >
              <div>
                <p className="admin-t__fila-titulo">
                  {t.productoNombre} · {dinero.format(t.monto)}
                </p>
                <p className="admin-t__fila-sub">
                  Venta {t.ventaIdPg ?? t._id.slice(-6)} · {t.vendedorNombre}{" "}
                  (vendedor) · {t.compradorNombre} · {formatearFecha(t.creadoEn)}
                </p>
                <div className="admin-t__etiquetas">
                  <span className={`admin-t__etiqueta ${claseEstado(t.estado)}`}>
                    {t.estadoTexto}
                  </span>
                  {t.disputa && (
                    <span className="admin-t__etiqueta admin-t__etiqueta--roja">
                      Disputa {t.disputa.estado}
                    </span>
                  )}
                  {t.reportes > 0 && (
                    <span className="admin-t__etiqueta admin-t__etiqueta--roja">
                      {t.reportes} reporte{t.reportes === 1 ? "" : "s"}
                    </span>
                  )}
                  {t.retenido && (
                    <span className="admin-t__etiqueta admin-t__etiqueta--amarilla">
                      Pago retenido
                    </span>
                  )}
                </div>
              </div>
              <div className="admin-t__fila-acciones">
                <button
                  type="button"
                  className="admin-t__boton admin-t__boton--secundario"
                  onClick={() => setConversacion(t._id)}
                >
                  Ver chat ({t.totalMensajes})
                </button>
              </div>
              <p className="admin-t__fila-texto">
                <strong>Motivo:</strong> {t.motivo}
              </p>
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

      {conversacion && (
        <ModalConversacionAdmin
          tipo="venta"
          id={conversacion}
          onCerrar={() => setConversacion(null)}
        />
      )}
    </div>
  );
}

export default AdminTransacciones;
