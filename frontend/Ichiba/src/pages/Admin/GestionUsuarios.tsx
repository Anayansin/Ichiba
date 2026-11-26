import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import {
  agregarUsuarioAListaNegra,
  fetchUsuarios,
  reactivarUsuario,
  suspenderUsuario,
  type UsuarioAdmin,
} from "../../services/adminService";
import {
  suscribirse,
  type EventoUsuario,
} from "../../services/suscripcionesService";
import ModalUsuarioAdmin from "./ModalUsuarioAdmin";
import "./GestionUsuarios.css";

const USUARIOS_POR_PAGINA = 10;
const MOTIVO_MINIMO = 10;
const MOTIVO_MAXIMO = 500;

const CONSULTA_USUARIOS = `
  subscription UsuariosEnVivo {
    usuariosAdmin {
      tipo mensaje generadoEn
      usuario {
        id nombreCompleto correo tipo suspendido
        puntosReputacion estadoCuenta fechaRegistro
        motivoSuspension saldoPendiente sancionHasta
        sancionPermanente revisionAdministrativa
      }
    }
  }
`;

function describirSancion(usuario: UsuarioAdmin): {
  texto: string;
  clase: string;
} | null {
  if (usuario.revisionAdministrativa) {
    return {
      texto: "En revisión administrativa",
      clase: "gestion-usuarios__estado--revision",
    };
  }
  if (usuario.sancionPermanente) {
    return {
      texto: "Bloqueo indefinido",
      clase: "gestion-usuarios__estado--cancelada",
    };
  }
  if (usuario.sancionHasta) {
    return {
      texto: `Bloqueado hasta ${new Date(usuario.sancionHasta).toLocaleDateString("es-MX")}`,
      clase: "gestion-usuarios__estado--suspendido",
    };
  }
  return null;
}

function GestionUsuarios() {
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([]);
  const [pagina, setPagina] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [porSuspender, setPorSuspender] = useState<UsuarioAdmin | null>(null);
  const [motivoSuspension, setMotivoSuspension] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const busquedaRef = useRef("");
  const [usuarioEnAccion, setUsuarioEnAccion] = useState<string | null>(null);
  const [usuarioAbierto, setUsuarioAbierto] = useState<string | null>(null);

  const paginaRef = useRef(pagina);
  useEffect(() => {
    paginaRef.current = pagina;
  }, [pagina]);

  const cargar = useCallback(
    async (
      paginaActual: number,
      silencioso = false,
      busquedaActual = busquedaRef.current,
    ) => {
      if (!silencioso) setCargando(true);
      setError("");
      try {
        const respuesta = await fetchUsuarios(
          paginaActual,
          USUARIOS_POR_PAGINA,
          busquedaActual,
        );
        setUsuarios(respuesta.usuarios);
        setTotal(respuesta.total);
        setTotalPaginas(respuesta.totalPaginas);
      } catch (err) {
        setError(
          (axios.isAxiosError(err) && err.response?.data?.message) ||
            "No pudimos cargar los usuarios",
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
    return suscribirse<EventoUsuario>(
      CONSULTA_USUARIOS,
      "usuariosAdmin",
      (evento) => {
        setAviso(evento.mensaje);
        cargar(paginaRef.current, true);
      },
      (err) =>
        console.warn("Suscripción de usuarios no disponible:", err),
    );
  }, [cargar]);

  async function reactivar(usuario: UsuarioAdmin) {
    setError("");
    setAviso("");
    setUsuarioEnAccion(usuario.id);

    try {
      const usuarioActualizado = await reactivarUsuario(usuario.id);

      setUsuarios((anteriores) =>
        anteriores.map((item) =>
          item.id === usuarioActualizado.id ? usuarioActualizado : item,
        ),
      );
      setAviso(`Usuario reactivado: ${usuarioActualizado.nombreCompleto}`);
    } catch (err) {
      setError(
        (axios.isAxiosError(err) && err.response?.data?.message) ||
          "No pudimos reactivar el usuario",
      );
    } finally {
      setUsuarioEnAccion(null);
    }
  }

  function abrirSuspension(usuario: UsuarioAdmin) {
    setError("");
    setAviso("");
    setMotivoSuspension("");
    setPorSuspender(usuario);
  }

  async function suspender(evento: React.FormEvent) {
    evento.preventDefault();
    if (!porSuspender) return;
    const motivo = motivoSuspension.trim();
    if (motivo.length < MOTIVO_MINIMO) {
      setError(
        `Escribe el motivo de la suspensión (mínimo ${MOTIVO_MINIMO} caracteres)`,
      );
      return;
    }

    setError("");
    setUsuarioEnAccion(porSuspender.id);

    try {
      const usuarioActualizado = await suspenderUsuario(porSuspender.id, motivo);
      setUsuarios((anteriores) =>
        anteriores.map((item) =>
          item.id === usuarioActualizado.id ? usuarioActualizado : item,
        ),
      );
      setAviso(
        `Cuenta suspendida: ${usuarioActualizado.nombreCompleto}. Se le envió el motivo por correo.`,
      );
      setPorSuspender(null);
      setMotivoSuspension("");
    } catch (err) {
      setError(
        (axios.isAxiosError(err) && err.response?.data?.message) ||
          "No pudimos suspender la cuenta",
      );
    } finally {
      setUsuarioEnAccion(null);
    }
  }

  async function agregarAListaNegra(usuario: UsuarioAdmin) {
    const motivo = window.prompt(
      `Motivo para agregar a ${usuario.nombreCompleto} a la lista negra:`,
      "Agregado desde Gestión de usuarios",
    );

    if (motivo === null) return;
    if (!motivo.trim()) {
      setError("Indica el motivo de la inclusión en la lista negra");
      return;
    }

    setError("");
    setAviso("");
    setUsuarioEnAccion(usuario.id);

    try {
      await agregarUsuarioAListaNegra(usuario.id, motivo.trim());
      setAviso(
        `Usuario agregado a la lista negra: ${usuario.nombreCompleto}`,
      );
    } catch (err) {
      setError(
        (axios.isAxiosError(err) && err.response?.data?.message) ||
          "No pudimos agregar el usuario a la lista negra",
      );
    } finally {
      setUsuarioEnAccion(null);
    }
  }

  if (cargando) {
    return <p className="gestion-usuarios__vacio">Cargando usuarios...</p>;
  }

  return (
    <div className="gestion-usuarios">
      <div className="gestion-usuarios__cabecera">
        <h2>Gestión de usuarios</h2>
        <span>{total} registrado(s)</span>
      </div>

      <form
        className="gestion-usuarios__buscador"
        onSubmit={(evento) => {
          evento.preventDefault();
          setPagina(1);
          cargar(1, false, busquedaRef.current);
        }}
      >
        <input
          type="search"
          placeholder="Buscar por nombre o correo"
          value={busqueda}
          onChange={(evento) => {
            setBusqueda(evento.target.value);
            busquedaRef.current = evento.target.value;
          }}
          aria-label="Buscar usuarios por nombre o correo"
        />
        <button type="submit">Buscar</button>
        {busqueda && (
          <button
            type="button"
            onClick={() => {
              setBusqueda("");
              busquedaRef.current = "";
              setPagina(1);
              cargar(1, false, "");
            }}
          >
            Limpiar
          </button>
        )}
      </form>

      {error && <p className="gestion-usuarios__error">{error}</p>}
      {aviso && <p className="gestion-usuarios__aviso">{aviso}</p>}

      {porSuspender && (
        <form className="gestion-usuarios__suspension" onSubmit={suspender}>
          <h3>Suspender a {porSuspender.nombreCompleto}</h3>
          <p>
            La cuenta no podrá iniciar sesión mientras esté suspendida. El
            motivo se le enviará por correo a {porSuspender.correo}.
          </p>
          <label htmlFor="motivo-suspension">Motivo de la suspensión</label>
          <textarea
            id="motivo-suspension"
            rows={3}
            maxLength={MOTIVO_MAXIMO}
            value={motivoSuspension}
            onChange={(evento) => setMotivoSuspension(evento.target.value)}
            placeholder="Por ejemplo: incumplimiento reiterado de entregas acordadas"
            autoFocus
          />
          <span
            className={`gestion-usuarios__contador${
              motivoSuspension.trim().length < MOTIVO_MINIMO
                ? " gestion-usuarios__contador--falta"
                : ""
            }`}
          >
            {motivoSuspension.trim().length}/{MOTIVO_MAXIMO} (mínimo{" "}
            {MOTIVO_MINIMO})
          </span>
          <div className="gestion-usuarios__suspension-acciones">
            <button
              type="button"
              className="gestion-usuarios__cancelar"
              onClick={() => setPorSuspender(null)}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="gestion-usuarios__suspender"
              disabled={
                usuarioEnAccion === porSuspender.id ||
                motivoSuspension.trim().length < MOTIVO_MINIMO
              }
            >
              Suspender cuenta
            </button>
          </div>
        </form>
      )}

      {usuarios.length === 0 ? (
        <p className="gestion-usuarios__vacio">No hay usuarios registrados.</p>
      ) : (
        <table className="gestion-usuarios__tabla">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Correo</th>
              <th>Tipo</th>
              <th>Registro</th>
              <th>Puntos</th>
              <th>Estado</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((usuario) => (
              <tr key={usuario.id}>
                <td>
                  <button
                    type="button"
                    className="gestion-usuarios__nombre"
                    onClick={() => setUsuarioAbierto(usuario.id)}
                    title="Ver y editar todos sus datos"
                  >
                    {usuario.nombreCompleto}
                  </button>
                </td>
                <td>{usuario.correo}</td>
                <td>{usuario.tipo}</td>
                <td>
                  {usuario.fechaRegistro
                    ? new Date(usuario.fechaRegistro).toLocaleDateString(
                        "es-MX",
                      )
                    : "Sin fecha"}
                </td>
                <td>
                  {usuario.puntosReputacion}/8
                  {Number(usuario.saldoPendiente ?? 0) > 0 && (
                    <span className="gestion-usuarios__saldo">
                      Saldo pendiente: ${Number(usuario.saldoPendiente).toFixed(2)}
                    </span>
                  )}
                </td>
                <td>
                  {usuario.estadoCuenta === "cancelada" ? (
                    <span className="gestion-usuarios__estado gestion-usuarios__estado--cancelada">
                      Cancelada
                    </span>
                  ) : (
                    <>
                      <span
                        className={`gestion-usuarios__estado ${
                          usuario.suspendido
                            ? "gestion-usuarios__estado--suspendido"
                            : ""
                        }`}
                      >
                        {usuario.suspendido
                          ? usuario.motivoSuspension === "saldo_pendiente"
                            ? "Suspendido por saldo"
                            : "Suspendido"
                          : "Activo"}
                      </span>
                      {(() => {
                        const sancion = describirSancion(usuario);
                        return sancion ? (
                          <span
                            className={`gestion-usuarios__estado ${sancion.clase}`}
                          >
                            {sancion.texto}
                          </span>
                        ) : null;
                      })()}
                    </>
                  )}
                </td>
                <td>
                  {usuario.estadoCuenta === "cancelada" ? (
                    <button
                      type="button"
                      className="gestion-usuarios__suspender gestion-usuarios__permanente"
                      disabled
                      title="La cancelación por 8 puntos es permanente"
                    >
                      Permanente
                    </button>
                  ) : usuario.suspendido ? (
                    <button
                      type="button"
                      className="gestion-usuarios__reactivar"
                      disabled={usuarioEnAccion === usuario.id}
                      onClick={() => reactivar(usuario)}
                    >
                      Reactivar
                    </button>
                  ) : (
                    <div className="gestion-usuarios__acciones">
                      <button
                        type="button"
                        className="gestion-usuarios__ver"
                        onClick={() => setUsuarioAbierto(usuario.id)}
                      >
                        Ver datos
                      </button>
                      {usuario.tipo !== "admin" && (
                        <button
                          type="button"
                          className="gestion-usuarios__suspender"
                          disabled={usuarioEnAccion === usuario.id}
                          onClick={() => abrirSuspension(usuario)}
                        >
                          Suspender
                        </button>
                      )}
                      <button
                        type="button"
                        className="gestion-usuarios__lista-negra"
                        title="No suspende la cuenta: bloquea sus datos para nuevas altas"
                        disabled={usuarioEnAccion === usuario.id}
                        onClick={() => agregarAListaNegra(usuario)}
                      >
                        Lista negra
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {usuarioAbierto && (
        <ModalUsuarioAdmin
          usuarioId={usuarioAbierto}
          onCerrar={() => setUsuarioAbierto(null)}
          onGuardado={() => cargar(paginaRef.current, true)}
        />
      )}

      <div className="gestion-usuarios__paginacion">
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

export default GestionUsuarios;
