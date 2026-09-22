import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Boton from "../../Boton/Boton";
import {
  loginUsuario,
  solicitarRecuperacion,
  verificarCodigoRecuperacion,
  restablecerPassword,
} from "../../../services/authService";
import { useAuth } from "../../../context/AuthContext";
import "./IniciarSesion.css";

interface IniciarSesionProps {
  onClose: () => void;
}

type Paso = "login" | "correo" | "codigo" | "password" | "exito";

function IniciarSesion({ onClose }: IniciarSesionProps) {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [paso, setPaso] = useState<Paso>("login");
  const [correo, setCorreo] = useState("");
  const [password, setPassword] = useState("");
  const [codigo, setCodigo] = useState("");
  const [passwordNueva, setPasswordNueva] = useState("");
  const [passwordConfirmar, setPasswordConfirmar] = useState("");
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(false);

  function reiniciarRecuperacion() {
    setPaso("login");
    setCodigo("");
    setPasswordNueva("");
    setPasswordConfirmar("");
    setError("");
    setMensaje("");
  }

  function obtenerError(err: any, porDefecto: string) {
    return err.response?.data?.message || porDefecto;
  }

  async function iniciarSesionForm() {
    setError("");
    setCargando(true);

    try {
      const data = await loginUsuario(correo, password);
      login(data.usuario, data.token);
      onClose();
      navigate("/panel-vendedor");
    } catch (err: any) {
      setError(obtenerError(err, "Error al iniciar sesión"));
    } finally {
      setCargando(false);
    }
  }

  async function solicitarCodigo() {
    setError("");
    setCargando(true);

    try {
      const data = await solicitarRecuperacion(correo);
      setMensaje(data.message);
      setCodigo("");
      setPaso("codigo");
    } catch (err: any) {
      setError(obtenerError(err, "No se pudo enviar el correo"));
    } finally {
      setCargando(false);
    }
  }

  async function verificarCodigo() {
    setError("");
    setCargando(true);

    try {
      await verificarCodigoRecuperacion(correo, codigo);
      setPaso("password");
    } catch (err: any) {
      setError(obtenerError(err, "Error al verificar el código"));
    } finally {
      setCargando(false);
    }
  }

  async function guardarPassword() {
    setError("");

    if (passwordNueva !== passwordConfirmar) {
      setError("Las contraseñas no coinciden");
      return;
    }

    setCargando(true);

    try {
      const data = await restablecerPassword(correo, codigo, passwordNueva);
      setMensaje(data.message);
      setPassword("");
      setPasswordNueva("");
      setPasswordConfirmar("");
      setPaso("exito");
    } catch (err: any) {
      setError(obtenerError(err, "Error al restablecer la contraseña"));
    } finally {
      setCargando(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (paso === "login") return iniciarSesionForm();
    if (paso === "correo") return solicitarCodigo();
    if (paso === "codigo") return verificarCodigo();
    if (paso === "password") return guardarPassword();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <form
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <button type="button" className="modal-close" onClick={onClose}>
          ✕
        </button>

        {paso === "login" && (
          <>
            <h2>Bienvenido a Ichiba</h2>
            <p>
              Introduce tu correo electronico a continuacion para iniciar sesion
              en tu cuenta.
            </p>

            {error && <p className="modal-error">{error}</p>}

            <div className="form-group">
              <label>Correo electronico</label>
              <input
                type="email"
                placeholder="Correo"
                className="modal-input"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>Contraseña</label>
              <input
                type="password"
                placeholder="Contraseña"
                className="modal-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <span
              className="recuperar-link"
              onClick={() => {
                setError("");
                setMensaje("");
                setPaso("correo");
              }}
            >
              ¿Olvidaste tu contraseña?
            </span>

            <Boton
              texto={cargando ? "Entrando..." : "Iniciar sesión"}
              onClick={() => {}}
              type="submit"
            />
            <Link to={"/registro"} onClick={onClose}>
              <Boton texto="No tengo cuenta" onClick={() => {}} />
            </Link>
          </>
        )}

        {paso === "correo" && (
          <>
            <h2>Recupera tu cuenta</h2>
            <p>
              Escribe el correo de tu cuenta y te enviaremos un código para
              cambiar tu contraseña.
            </p>

            {error && <p className="modal-error">{error}</p>}

            <div className="form-group">
              <label>Correo electronico</label>
              <input
                type="email"
                placeholder="Correo"
                className="modal-input"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                required
              />
            </div>

            <Boton
              texto={cargando ? "Enviando..." : "Enviar código"}
              onClick={() => {}}
              type="submit"
            />
            <span className="recuperar-link" onClick={reiniciarRecuperacion}>
              Volver a iniciar sesión
            </span>
          </>
        )}

        {paso === "codigo" && (
          <>
            <h2>Revisa tu correo</h2>
            <p>{mensaje}</p>

            {error && <p className="modal-error">{error}</p>}

            <div className="form-group">
              <label>Código de recuperación</label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="6 dígitos"
                className="modal-input modal-input-codigo"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                required
              />
            </div>

            <Boton
              texto={cargando ? "Verificando..." : "Verificar código"}
              onClick={() => {}}
              type="submit"
            />
            <span className="recuperar-link" onClick={reiniciarRecuperacion}>
              Volver a iniciar sesión
            </span>
          </>
        )}

        {paso === "password" && (
          <>
            <h2>Nueva contraseña</h2>
            <p>Elige tu nueva contraseña para tu cuenta de Ichiba.</p>

            {error && <p className="modal-error">{error}</p>}

            <div className="form-group">
              <label>Nueva contraseña</label>
              <input
                type="password"
                placeholder="Nueva contraseña"
                className="modal-input"
                value={passwordNueva}
                onChange={(e) => setPasswordNueva(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>Confirmar contraseña</label>
              <input
                type="password"
                placeholder="Repite tu nueva contraseña"
                className="modal-input"
                value={passwordConfirmar}
                onChange={(e) => setPasswordConfirmar(e.target.value)}
                required
              />
            </div>

            <p className="modal-nota">
              Mínimo 10 caracteres, con mayúscula, minúscula, número y un
              carácter especial (!@#$%&*-_)
            </p>

            <Boton
              texto={cargando ? "Guardando..." : "Guardar contraseña"}
              onClick={() => {}}
              type="submit"
            />
            <span className="recuperar-link" onClick={reiniciarRecuperacion}>
              Volver a iniciar sesión
            </span>
          </>
        )}

        {paso === "exito" && (
          <>
            <h2>Contraseña actualizada</h2>
            <p className="modal-exito">{mensaje}</p>

            <Boton
              texto="Iniciar sesión"
              onClick={reiniciarRecuperacion}
              type="button"
            />
          </>
        )}
      </form>
    </div>
  );
}

export default IniciarSesion;
