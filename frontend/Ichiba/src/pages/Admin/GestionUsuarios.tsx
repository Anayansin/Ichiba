import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import {
  fetchUsuarios,
  reactivarUsuario,
  suspenderUsuario,
  type UsuarioAdmin,
} from "../../services/adminService";
import {
  suscribirse,
  type EventoUsuario,
} from "../../services/suscripcionesService";
import "./GestionUsuarios.css";

const USUARIOS_POR_PAGINA = 10;

/** Fase 4: la tabla se refresca al instante cuando cambia cualquier cuenta. */
const CONSULTA_USUARIOS = `
  subscription UsuariosEnVivo {
    usuariosAdmin {
      tipo mensaje generadoEn
      usuario {
        id nombreCompleto correo tipo suspendido
        puntosReputacion estadoCuenta fechaRegistro
      }
    }
  }
`;

function GestionUsuarios() {
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([]);
  const [pagina, setPagina] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [usuarioEnAccion, setUsuarioEnAccion] = useState<string | null>(null);

  // La suscripción se abre una sola vez; este ref le da siempre la página
  // visible en el momento del evento.
  const paginaRef = useRef(pagina);
  useEffect(() => {
    paginaRef.current = pagina;
  }, [pagina]);

  const cargar = useCallback(async (paginaActual: number, silencioso = false) => {
    if (!silencioso) setCargando(true);
    setError("");
    try {
      const respuesta = await fetchUsuarios(paginaActual, USUARIOS_POR_PAGINA);
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
  }, []);

  useEffect(() => {
    cargar(pagina);
  }, [cargar, pagina]);

  // Fase 4: registros, suspensiones, reactivaciones, puntos y cancelaciones
  // llegan por GraphQL Subscription y la tabla se refresca sin recargar.
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

  async function cambiarSuspension(usuario: UsuarioAdmin) {
    setError("");
    setAviso("");
    setUsuarioEnAccion(usuario.id);

    try {
      const usuarioActualizado = usuario.suspendido
        ? await reactivarUsuario(usuario.id)
        : await suspenderUsuario(usuario.id);

      setUsuarios((anteriores) =>
        anteriores.map((item) =>
          item.id === usuarioActualizado.id ? usuarioActualizado : item,
        ),
      );
      setAviso(
        usuarioActualizado.suspendido
          ? `Usuario suspendido: ${usuarioActualizado.nombreCompleto}`
          : `Usuario reactivado: ${usuarioActualizado.nombreCompleto}`,
      );
    } catch (err) {
      setError(
        (axios.isAxiosError(err) && err.response?.data?.message) ||
          "No pudimos actualizar el usuario",
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

      {error && <p className="gestion-usuarios__error">{error}</p>}
      {aviso && <p className="gestion-usuarios__aviso">{aviso}</p>}

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
                <td>{usuario.nombreCompleto}</td>
                <td>{usuario.correo}</td>
                <td>{usuario.tipo}</td>
                <td>
                  {usuario.fechaRegistro
                    ? new Date(usuario.fechaRegistro).toLocaleDateString(
                        "es-MX",
                      )
                    : "Sin fecha"}
                </td>
                {/* RQNF10.1 / RQNF10.3: puntos acumulados (8 = cancelación). */}
                <td>{usuario.puntosReputacion}/8</td>
                <td>
                  {usuario.estadoCuenta === "cancelada" ? (
                    <span className="gestion-usuarios__estado gestion-usuarios__estado--cancelada">
                      Cancelada
                    </span>
                  ) : (
                    <span
                      className={`gestion-usuarios__estado ${
                        usuario.suspendido
                          ? "gestion-usuarios__estado--suspendido"
                          : ""
                      }`}
                    >
                      {usuario.suspendido ? "Suspendido" : "Activo"}
                    </span>
                  )}
                </td>
                <td>
                  {usuario.estadoCuenta === "cancelada" ? (
                    <button
                      type="button"
                      className="gestion-usuarios__suspender gestion-usuarios__permanente"
                      disabled
                      title="La cancelación por 8 puntos es permanente (RQNF10.3)"
                    >
                      Permanente
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={
                        usuario.suspendido
                          ? "gestion-usuarios__reactivar"
                          : "gestion-usuarios__suspender"
                      }
                      disabled={usuarioEnAccion === usuario.id}
                      onClick={() => cambiarSuspension(usuario)}
                    >
                      {usuario.suspendido ? "Reactivar" : "Suspender"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
