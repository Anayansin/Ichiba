import { useEffect, useState } from "react";
import axios from "axios";
import {
  fetchUsuarios,
  reactivarUsuario,
  suspenderUsuario,
  type UsuarioAdmin,
} from "../../services/adminService";
import "./GestionUsuarios.css";

const USUARIOS_POR_PAGINA = 10;

function GestionUsuarios() {
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([]);
  const [pagina, setPagina] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [usuarioEnAccion, setUsuarioEnAccion] = useState<string | null>(null);

  useEffect(() => {
    setCargando(true);
    setError("");
    fetchUsuarios(pagina, USUARIOS_POR_PAGINA)
      .then((respuesta) => {
        setUsuarios(respuesta.usuarios);
        setTotal(respuesta.total);
        setTotalPaginas(respuesta.totalPaginas);
      })
      .catch((err) =>
        setError(
          (axios.isAxiosError(err) && err.response?.data?.message) ||
            "No pudimos cargar los usuarios",
        ),
      )
      .finally(() => setCargando(false));
  }, [pagina]);

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
                <td>
                  <span
                    className={`gestion-usuarios__estado ${
                      usuario.suspendido
                        ? "gestion-usuarios__estado--suspendido"
                        : ""
                    }`}
                  >
                    {usuario.suspendido ? "Suspendido" : "Activo"}
                  </span>
                </td>
                <td>
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
