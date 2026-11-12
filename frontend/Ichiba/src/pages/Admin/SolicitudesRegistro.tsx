import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import {
  fetchSolicitudesRegistro,
  resolverSolicitudRegistro,
  type SolicitudRegistroAdmin,
} from "../../services/adminService";
import {
  suscribirse,
  type EventoSolicitudRegistro,
} from "../../services/suscripcionesService";
import "./SolicitudesRegistro.css";

const SOLICITUDES_POR_PAGINA = 20;

/** RQNF1.9: las solicitudes llegan por GraphQL y la tabla se refresca sola. */
const CONSULTA_SOLICITUDES = `
  subscription SolicitudesRegistroEnVivo {
    solicitudesRegistro { tipo mensaje pendientes generadoEn }
  }
`;

const MOTIVOS: Record<string, string> = {
  "lista-negra": "Datos en la lista negra",
  "datos-en-uso": "Datos ya usados por otra cuenta",
  "correo-en-uso": "El correo ya tiene una cuenta",
};

const ESTADOS: Record<string, string> = {
  pendiente: "Pendiente",
  "en-revision": "En revisión",
  resuelta: "Resuelta",
  descartada: "Descartada",
};

const CAMPOS: Record<string, string> = {
  rfc: "RFC",
  curp: "CURP",
  ineCodigoReverso: "Código de la INE",
  correo: "Correo",
  telefono: "Teléfono",
  identificacion: "Datos de identificación",
};

function SolicitudesRegistro() {
  const [solicitudes, setSolicitudes] = useState<SolicitudRegistroAdmin[]>(
    [],
  );
  const [pagina, setPagina] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [atendiendo, setAtendiendo] = useState<string | null>(null);
  const [respuestas, setRespuestas] = useState<Record<string, string>>({});

  const paginaRef = useRef(pagina);
  useEffect(() => {
    paginaRef.current = pagina;
  }, [pagina]);

  const cargar = useCallback(
    async (paginaActual: number, silencioso = false) => {
      if (!silencioso) setCargando(true);
      setError("");
      try {
        const respuesta = await fetchSolicitudesRegistro(
          paginaActual,
          SOLICITUDES_POR_PAGINA,
        );
        setSolicitudes(respuesta.solicitudes);
        setTotal(respuesta.total);
        setTotalPaginas(respuesta.totalPaginas);
      } catch (err) {
        setError(
          (axios.isAxiosError(err) && err.response?.data?.message) ||
            "No pudimos cargar las solicitudes de registro",
        );
      } finally {
        if (!silencioso) setCargando(false);
      }
    },
    [],
  );

  useEffect(() => {
    cargar(pagina);
  }, [cargar, pagina]);

  useEffect(() => {
    return suscribirse<EventoSolicitudRegistro>(
      CONSULTA_SOLICITUDES,
      "solicitudesRegistro",
      (evento) => {
        setAviso(`${evento.mensaje} · ${evento.pendientes} pendiente(s)`);
        cargar(paginaRef.current, true);
      },
      (err) =>
        console.warn("Suscripción de solicitudes de registro no disponible:", err),
    );
  }, [cargar]);

  async function atender(
    solicitud: SolicitudRegistroAdmin,
    estado: "en-revision" | "resuelta" | "descartada",
  ) {
    setError("");
    setAviso("");
    setAtendiendo(solicitud.id);

    try {
      const respuesta = await resolverSolicitudRegistro(
        solicitud.id,
        estado,
        respuestas[solicitud.id] ?? "",
      );

      setSolicitudes((anteriores) =>
        anteriores.map((item) =>
          item.id === solicitud.id ? respuesta.solicitud : item,
        ),
      );
      setAviso(
        estado === "resuelta"
          ? "Solicitud resuelta: se le avisó a la persona por correo"
          : estado === "descartada"
            ? "Solicitud descartada: se le avisó a la persona por correo"
            : "Solicitud marcada en revisión",
      );
    } catch (err) {
      setError(
        (axios.isAxiosError(err) && err.response?.data?.message) ||
          "No se pudo atender la solicitud",
      );
    } finally {
      setAtendiendo(null);
    }
  }

  return (
    <div className="solicitudes-registro">
      <div className="solicitudes-registro__cabecera">
        <h2>Solicitudes de registro</h2>
        <span>{total} solicitud(es)</span>
      </div>

      <p className="solicitudes-registro__nota">
        Cuando el sistema deniega un alta porque los datos están en la lista
        negra o ya pertenecen a otra cuenta, la persona puede pedir que
        revisemos su caso. Aquí llegan esas solicitudes; la respuesta se le
        manda por correo a la persona.
      </p>

      {error && <p className="solicitudes-registro__error">{error}</p>}
      {aviso && <p className="solicitudes-registro__aviso">{aviso}</p>}

      {cargando ? (
        <p className="solicitudes-registro__vacio">Cargando solicitudes...</p>
      ) : solicitudes.length === 0 ? (
        <p className="solicitudes-registro__vacio">
          No hay solicitudes de registro.
        </p>
      ) : (
        <div className="solicitudes-registro__lista">
          {solicitudes.map((solicitud) => (
            <article
              key={solicitud.id}
              className="solicitudes-registro__item"
            >
              <header className="solicitudes-registro__datos">
                <div>
                  <strong>{solicitud.nombreCompleto || "Sin nombre"}</strong>
                  <span>{solicitud.correo}</span>
                  <span>
                    {solicitud.telefono || "Sin teléfono"} ·{" "}
                    {solicitud.rfc || "Sin RFC"}
                  </span>
                </div>
                <div className="solicitudes-registro__etiquetas">
                  <span className="solicitudes-registro__motivo">
                    {MOTIVOS[solicitud.motivoBloqueo] ??
                      solicitud.motivoBloqueo}
                  </span>
                  <span className="solicitudes-registro__estado">
                    {ESTADOS[solicitud.estado] ?? solicitud.estado}
                  </span>
                </div>
              </header>

              <p className="solicitudes-registro__campos">
                Campos que coincidieron:{" "}
                {solicitud.camposCoincidentes.length > 0
                  ? solicitud.camposCoincidentes
                      .map((campo) => CAMPOS[campo] ?? campo)
                      .join(", ")
                  : "sin detalle"}
              </p>

              {solicitud.mensaje && (
                <p className="solicitudes-registro__mensaje">
                  “{solicitud.mensaje}”
                </p>
              )}

              {solicitud.respuesta && (
                <p className="solicitudes-registro__respuesta">
                  Respuesta enviada: {solicitud.respuesta}
                </p>
              )}

              <div className="solicitudes-registro__respuesta-caja">
                <input
                  type="text"
                  placeholder="Respuesta para la persona (opcional)"
                  value={respuestas[solicitud.id] ?? ""}
                  onChange={(e) =>
                    setRespuestas((actuales) => ({
                      ...actuales,
                      [solicitud.id]: e.target.value,
                    }))
                  }
                />
                <button
                  type="button"
                  disabled={atendiendo === solicitud.id}
                  onClick={() => atender(solicitud, "en-revision")}
                >
                  Poner en revisión
                </button>
                <button
                  type="button"
                  className="solicitudes-registro__resolver"
                  disabled={atendiendo === solicitud.id}
                  onClick={() => atender(solicitud, "resuelta")}
                >
                  Autorizar registro
                </button>
                <button
                  type="button"
                  className="solicitudes-registro__descartar"
                  disabled={atendiendo === solicitud.id}
                  onClick={() => atender(solicitud, "descartada")}
                >
                  Descartar
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="solicitudes-registro__paginacion">
        <button
          type="button"
          disabled={pagina <= 1}
          onClick={() => setPagina((valor) => valor - 1)}
        >
          Anterior
        </button>
        <span>
          Página {pagina} de {totalPaginas}
        </span>
        <button
          type="button"
          disabled={pagina >= totalPaginas}
          onClick={() => setPagina((valor) => valor + 1)}
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}

export default SolicitudesRegistro;
