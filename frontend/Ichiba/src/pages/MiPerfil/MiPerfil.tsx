import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  fetchPerfil,
  fetchDatosSensibles,
} from "../../services/usuarioServices";
import type {
  DatosSensibles,
  PerfilUsuario,
} from "../../services/usuarioServices";
import {
  estadoVinculacionPayPal,
  iniciarVinculacionPayPal,
} from "../../services/pagoService";
import { mensajeDeError } from "../../utils/errores";
import "./MiPerfil.css";

const OCULTO = "••••••••••";

const TEXTO_ESTADO_CUENTA: Record<string, string> = {
  activa: "Activa",
  cancelada: "Cancelada",
  suspendida: "Suspendida",
};

const TEXTO_TIPO: Record<string, string> = {
  vendedor: "Vendedor",
  comprador: "Comprador",
  admin: "Administrador",
};

type Vinculacion = Awaited<ReturnType<typeof estadoVinculacionPayPal>>;

function MiPerfil() {
  const { usuario } = useAuth();
  const [perfil, setPerfil] = useState<PerfilUsuario | null>(null);
  const [vinculacion, setVinculacion] = useState<Vinculacion | null>(null);
  const [error, setError] = useState("");

  const [sensibles, setSensibles] = useState<DatosSensibles | null>(null);
  const [pidiendoPassword, setPidiendoPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [verificando, setVerificando] = useState(false);
  const [errorPassword, setErrorPassword] = useState("");
  const [abriendoPaypal, setAbriendoPaypal] = useState(false);

  useEffect(() => {
    if (!usuario) return;
    fetchPerfil()
      .then(setPerfil)
      .catch((err) =>
        setError(mensajeDeError(err) || "No pudimos cargar tu perfil"),
      );
    if (usuario.tipo !== "admin") {
      estadoVinculacionPayPal()
        .then(setVinculacion)
        .catch(() => setVinculacion(null));
    }
  }, [usuario]);

  if (!usuario) return <Navigate to="/" replace />;

  async function mostrarDatos(evento: FormEvent) {
    evento.preventDefault();
    setErrorPassword("");
    setVerificando(true);
    try {
      const datos = await fetchDatosSensibles(password);
      setSensibles(datos);
      setPidiendoPassword(false);
      setPassword("");
    } catch (err) {
      setErrorPassword(
        mensajeDeError(err) || "No pudimos verificar tu contraseña",
      );
    } finally {
      setVerificando(false);
    }
  }

  function ocultarDatos() {
    setSensibles(null);
    setPidiendoPassword(false);
    setPassword("");
    setErrorPassword("");
  }

  async function vincularPaypal() {
    setAbriendoPaypal(true);
    try {
      const { url } = await iniciarVinculacionPayPal();
      window.location.href = url;
    } catch (err) {
      setError(mensajeDeError(err) || "No se pudo abrir PayPal");
      setAbriendoPaypal(false);
    }
  }

  const camposSensibles: {
    etiqueta: string;
    dato: string | null | undefined;
  }[] = [
    { etiqueta: "Teléfono", dato: sensibles?.telefono },
    { etiqueta: "Domicilio", dato: sensibles?.direccion },
    { etiqueta: "RFC", dato: sensibles?.rfc },
    { etiqueta: "CURP", dato: sensibles?.curp },
    { etiqueta: "Código de la INE", dato: sensibles?.ineCodigoReverso },
    { etiqueta: "Correo de PayPal", dato: sensibles?.paypalEmail },
  ];

  const miembroDesde = perfil?.createdAt
    ? new Date(perfil.createdAt).toLocaleDateString("es-MX", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";

  return (
    <div className="mi-perfil">
      <h1>Mi perfil</h1>
      {error && <p className="mi-perfil__error">{error}</p>}

      <section className="mi-perfil__tarjeta">
        <h2>Cuenta</h2>
        <dl className="mi-perfil__lista">
          <div>
            <dt>Nombre</dt>
            <dd>{perfil?.nombreCompleto ?? usuario.nombreCompleto}</dd>
          </div>
          <div>
            <dt>Correo</dt>
            <dd>
              {perfil?.correo ?? usuario.correo}
              {perfil && (
                <span
                  className={`mi-perfil__etiqueta ${perfil.correoVerificado ? "mi-perfil__etiqueta--ok" : ""}`}
                >
                  {perfil.correoVerificado ? "Verificado" : "Sin verificar"}
                </span>
              )}
            </dd>
          </div>
          <div>
            <dt>Tipo de cuenta</dt>
            <dd>{TEXTO_TIPO[usuario.tipo] ?? usuario.tipo}</dd>
          </div>
          {perfil?.estadoCuenta && (
            <div>
              <dt>Estado</dt>
              <dd>
                {TEXTO_ESTADO_CUENTA[perfil.estadoCuenta] ??
                  perfil.estadoCuenta}
              </dd>
            </div>
          )}
          {miembroDesde && (
            <div>
              <dt>Miembro desde</dt>
              <dd>{miembroDesde}</dd>
            </div>
          )}
          {usuario.tipo !== "admin" && vinculacion && (
            <div>
              <dt>PayPal</dt>
              <dd>
                {vinculacion.vinculado ? (
                  <span className="mi-perfil__etiqueta mi-perfil__etiqueta--ok">
                    Cuenta vinculada
                  </span>
                ) : (
                  <>
                    <span className="mi-perfil__etiqueta">Sin vincular</span>
                    <button
                      type="button"
                      className="mi-perfil__enlace"
                      onClick={vincularPaypal}
                      disabled={abriendoPaypal}
                    >
                      {abriendoPaypal ? "Abriendo PayPal..." : "Vincular"}
                    </button>
                  </>
                )}
              </dd>
            </div>
          )}
        </dl>
      </section>

      <section className="mi-perfil__tarjeta">
        <div className="mi-perfil__encabezado">
          <h2>Datos personales</h2>
          {sensibles ? (
            <button
              type="button"
              className="mi-perfil__boton-secundario"
              onClick={ocultarDatos}
            >
              Ocultar
            </button>
          ) : (
            !pidiendoPassword && (
              <button
                type="button"
                className="mi-perfil__boton"
                onClick={() => setPidiendoPassword(true)}
              >
                Mostrar datos
              </button>
            )
          )}
        </div>

        {pidiendoPassword && (
          <form className="mi-perfil__password" onSubmit={mostrarDatos}>
            <label htmlFor="mi-perfil-password">
              Escribe tu contraseña para ver tus datos
            </label>
            <div className="mi-perfil__password-fila">
              <input
                id="mi-perfil-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
              />
              <button
                type="submit"
                className="mi-perfil__boton"
                disabled={verificando || !password}
              >
                {verificando ? "Verificando..." : "Confirmar"}
              </button>
              <button
                type="button"
                className="mi-perfil__boton-secundario"
                onClick={ocultarDatos}
              >
                Cancelar
              </button>
            </div>
            {errorPassword && (
              <p className="mi-perfil__error mi-perfil__error--chico">
                {errorPassword}
              </p>
            )}
            <Link
              to="/recuperar-password"
              state={{ correo: usuario.correo }}
              className="mi-perfil__olvide"
            >
              ¿Olvidaste tu contraseña?
            </Link>
          </form>
        )}

        <dl className="mi-perfil__lista">
          {camposSensibles.map((campo) => (
            <div key={campo.etiqueta}>
              <dt>{campo.etiqueta}</dt>
              <dd className={sensibles ? "" : "mi-perfil__oculto"}>
                {sensibles ? campo.dato || "Sin registrar" : OCULTO}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}

export default MiPerfil;
