import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Boton from "../../Boton/Boton";
import { loginUsuario } from "../../../services/authService";
import { useAuth } from "../../../context/AuthContext";
import "./IniciarSesion.css";

interface IniciarSesionProps {
  onClose: () => void;
}

function IniciarSesion({ onClose }: IniciarSesionProps) {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [correo, setCorreo] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setCargando(true);

    try {
      const data = await loginUsuario(correo, password);
      login(data.usuario, data.token);
      onClose();
      navigate("/panel-vendedor");
    } catch (err: any) {
      const mensaje = err.response?.data?.message || "Error al iniciar sesión";
      setError(mensaje);
    } finally {
      setCargando(false);
    }
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

        <h2>Bienvenido a Ichiba</h2>
        <p>
          Introduce tu correo electronico a continuacion para iniciar sesion en
          tu cuenta.
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

        <span className="recuperar-link">¿Olvidaste tu contraseña?</span>

        <Boton
          texto={cargando ? "Entrando..." : "Iniciar sesión"}
          onClick={() => {}}
          type="submit"
        />
        <Link to={"/registro"} onClick={onClose}>
          <Boton texto="No tengo cuenta" onClick={() => {}} />
        </Link>
      </form>
    </div>
  );
}

export default IniciarSesion;
