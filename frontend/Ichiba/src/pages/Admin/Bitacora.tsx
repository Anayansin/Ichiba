import { useEffect, useState } from "react";
import {
  fetchBitacora,
  type EntradaBitacora,
} from "../../services/adminService";
import { mensajeDeError } from "../../utils/errores";
import "./Bitacora.css";

const ACCIONES = [
  { id: "", etiqueta: "Todas" },
  { id: "inicio_sesion", etiqueta: "Inicios de sesión" },
  { id: "publicacion", etiqueta: "Publicaciones" },
  { id: "fila", etiqueta: "Filas" },
  { id: "pago", etiqueta: "Pagos" },
  { id: "reporte", etiqueta: "Reportes" },
  { id: "sancion", etiqueta: "Sanciones" },
];

const FORMATO_FECHA = new Intl.DateTimeFormat("es-MX", {
  timeZone: "America/Mexico_City",
  dateStyle: "short",
  timeStyle: "medium",
});

function quien(entrada: EntradaBitacora): string {
  if (entrada.actorTipo === "sistema") return "Sistema";
  if (entrada.actorNombre) return entrada.actorNombre;
  if (entrada.actorTipo === "usuario") return `Usuario #${entrada.actorId}`;
  if (entrada.actorTipo === "comprador") {
    return `Comprador ${String(entrada.actorId).slice(0, 8)}`;
  }
  return "Visitante";
}

function Bitacora() {
  const [entradas, setEntradas] = useState<EntradaBitacora[]>([]);
  const [accion, setAccion] = useState("");
  const [actor, setActor] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setCargando(true);
    setError("");
    fetchBitacora({ accion: accion || undefined, actor: busqueda || undefined })
      .then(setEntradas)
      .catch((err) =>
        setError(mensajeDeError(err) || "No pudimos cargar la bitácora"),
      )
      .finally(() => setCargando(false));
  }, [accion, busqueda]);

  return (
    <div className="bitacora">
      <h2>Bitácora de acciones</h2>
      <p className="bitacora__nota">
        Inicios de sesión, publicaciones, filas, pagos, reportes y sanciones,
        con fecha y hora del centro de México (GMT-6).
      </p>

      <form
        className="bitacora__filtros"
        onSubmit={(e) => {
          e.preventDefault();
          setBusqueda(actor.trim());
        }}
      >
        <select value={accion} onChange={(e) => setAccion(e.target.value)}>
          {ACCIONES.map((opcion) => (
            <option key={opcion.id} value={opcion.id}>
              {opcion.etiqueta}
            </option>
          ))}
        </select>
        <input
          type="search"
          placeholder="Correo o número de usuario"
          value={actor}
          onChange={(e) => setActor(e.target.value)}
        />
        <button type="submit">Buscar</button>
      </form>

      {error && <p className="bitacora__error">{error}</p>}
      {cargando ? (
        <p className="bitacora__vacio">Cargando...</p>
      ) : entradas.length === 0 ? (
        <p className="bitacora__vacio">No hay acciones registradas.</p>
      ) : (
        <ul className="bitacora__lista">
          {entradas.map((entrada) => (
            <li key={entrada._id}>
              <span className="bitacora__fecha">
                {FORMATO_FECHA.format(new Date(entrada.createdAt))}
              </span>
              <span className="bitacora__quien">{quien(entrada)}</span>
              <span>{entrada.descripcion}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default Bitacora;
