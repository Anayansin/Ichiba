import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  editarUsuarioAdmin,
  fetchUsuarioDetalleAdmin,
  type CambiosUsuarioAdmin,
  type UsuarioDetalleAdmin,
} from "../../services/adminTotalService";
import { mensajeDeError } from "../../utils/errores";
import { dinero, formatearFecha } from "./AdminComunes";
import "./AdminTotal.css";

const CAMPOS: { campo: keyof CambiosUsuarioAdmin; etiqueta: string; ancho?: boolean }[] = [
  { campo: "nombreCompleto", etiqueta: "Nombre completo", ancho: true },
  { campo: "correo", etiqueta: "Correo" },
  { campo: "telefono", etiqueta: "Teléfono" },
  { campo: "direccion", etiqueta: "Domicilio", ancho: true },
  { campo: "rfc", etiqueta: "RFC" },
  { campo: "curp", etiqueta: "CURP" },
  { campo: "paypalEmail", etiqueta: "Correo de PayPal" },
];

// Todos los datos de una cuenta, editables por el administrador.
function ModalUsuarioAdmin({
  usuarioId,
  onCerrar,
  onGuardado,
}: {
  usuarioId: string;
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const [usuario, setUsuario] = useState<UsuarioDetalleAdmin | null>(null);
  const [formulario, setFormulario] = useState<CambiosUsuarioAdmin>({});
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    fetchUsuarioDetalleAdmin(usuarioId)
      .then((datos) => {
        setUsuario(datos);
        setFormulario({
          nombreCompleto: datos.nombreCompleto,
          correo: datos.correo,
          telefono: datos.telefono,
          direccion: datos.direccion,
          rfc: datos.rfc,
          curp: datos.curp ?? "",
          paypalEmail: datos.paypalEmail,
          tipo: datos.tipo,
        });
      })
      .catch((err) =>
        setError(mensajeDeError(err) || "No se pudo cargar el usuario"),
      );
  }, [usuarioId]);

  async function guardar(evento: FormEvent) {
    evento.preventDefault();
    if (!usuario) return;
    const cambios: CambiosUsuarioAdmin = {};
    for (const [campo, valor] of Object.entries(formulario) as [
      keyof CambiosUsuarioAdmin,
      string,
    ][]) {
      if ((usuario[campo] ?? "") !== valor) {
        (cambios as Record<string, string>)[campo] = valor;
      }
    }
    if (!Object.keys(cambios).length) {
      setAviso("No hay cambios que guardar");
      return;
    }
    setGuardando(true);
    setError("");
    setAviso("");
    try {
      const respuesta = await editarUsuarioAdmin(usuario.id, cambios);
      setUsuario(respuesta.usuario);
      setAviso(respuesta.message);
      onGuardado();
    } catch (err) {
      setError(mensajeDeError(err) || "No se pudo guardar el usuario");
    } finally {
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
            <h3>{usuario?.nombreCompleto ?? "Usuario"}</h3>
            {usuario && (
              <p>
                Cuenta n.º {usuario.id} · registrada{" "}
                {formatearFecha(usuario.createdAt)}
              </p>
            )}
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
          {aviso && <p className="admin-t__aviso">{aviso}</p>}
          {!usuario && !error && (
            <p className="admin-t__cargando">Cargando...</p>
          )}

          {usuario && (
            <>
              <div className="admin-t__datos">
                <div className="admin-t__dato">
                  <strong>{usuario.estadoCuenta}</strong>
                  Estado{usuario.suspendido ? " (suspendida)" : ""}
                </div>
                <div className="admin-t__dato">
                  <strong>{usuario.puntosReputacion}</strong>
                  Puntos de infracción
                </div>
                <div className="admin-t__dato">
                  <strong>{dinero.format(usuario.saldoPendiente ?? 0)}</strong>
                  Saldo pendiente
                </div>
                <div className="admin-t__dato">
                  <strong>{usuario.totales.productos}</strong>
                  Productos
                </div>
                <div className="admin-t__dato">
                  <strong>{usuario.totales.promocionales}</strong>
                  Promocionales
                </div>
                <div className="admin-t__dato">
                  <strong>{usuario.totales.ventas}</strong>
                  Ventas ({usuario.ventasExitosas} exitosas)
                </div>
              </div>

              <div className="admin-t__form">
                {CAMPOS.map(({ campo, etiqueta, ancho }) => (
                  <label key={campo} className={ancho ? "admin-t__ancho" : ""}>
                    {etiqueta}
                    <input
                      value={formulario[campo] ?? ""}
                      onChange={(e) =>
                        setFormulario((f) => ({ ...f, [campo]: e.target.value }))
                      }
                    />
                  </label>
                ))}
                <label>
                  Tipo de cuenta
                  <select
                    value={formulario.tipo ?? "vendedor"}
                    onChange={(e) =>
                      setFormulario((f) => ({ ...f, tipo: e.target.value }))
                    }
                  >
                    <option value="vendedor">Vendedor</option>
                    <option value="admin">Administrador</option>
                  </select>
                </label>
              </div>

              <div className="admin-t__resumen">
                <p>
                  <strong>Código de la INE:</strong>{" "}
                  {usuario.ineCodigoReverso || "Sin registrar"}
                </p>
                <p>
                  <strong>INE:</strong>{" "}
                  {usuario.tieneIneFrente && usuario.tieneIneReverso
                    ? "Frente y reverso registrados"
                    : "Incompleta"}
                </p>
                <p>
                  <strong>Correo verificado:</strong>{" "}
                  {usuario.correoVerificado ? "Sí" : "No"}
                </p>
                <p>
                  <strong>Reportes recibidos:</strong> {usuario.totalReportes}
                </p>
                {usuario.motivoSuspension && (
                  <p>
                    <strong>Motivo de suspensión:</strong>{" "}
                    {usuario.motivoSuspension}
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        <div className="admin-t__modal-pie">
          <button
            type="button"
            className="admin-t__boton admin-t__boton--secundario"
            onClick={onCerrar}
          >
            Cerrar
          </button>
          <button
            type="submit"
            className="admin-t__boton"
            disabled={!usuario || guardando}
          >
            {guardando ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default ModalUsuarioAdmin;
