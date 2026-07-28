import { Link } from "react-router-dom";
import Boton from "../../Boton/Boton";
import "./IniciarSesion.css";

interface IniciarSesionProps {
  onClose: () => void;
}

function IniciarSesion({ onClose }: IniciarSesionProps) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>
          ✕
        </button>

        <h2>Bienvenido a Ichiba</h2>
        <p>
          Introduce tu correo electrónico a continuación para iniciar sesión en
          tu cuenta.
        </p>

        <div className="form-group">
          <label>Correo electrónico</label>
          <input type="email" placeholder="Correo" className="modal-input" />
        </div>

        <div className="form-group">
          <label>Contraseña</label>
          <input
            type="password"
            placeholder="Contraseña"
            className="modal-input"
          />
        </div>

        <span className="recuperar-link">¿Olvidaste tu contraseña?</span>

        <Boton texto="Iniciar sesión" onClick={() => {}} />
        <Link to={"/registro"} onClick={onClose}>
          <Boton texto="No tengo cuenta" onClick={() => {}} />
        </Link>
      </div>
    </div>
  );
}

export default IniciarSesion;
