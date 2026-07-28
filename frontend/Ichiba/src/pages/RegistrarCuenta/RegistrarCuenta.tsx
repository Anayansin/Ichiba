import "./RegistrarCuenta.css";
import Boton from "../../components/Boton/Boton";

function RegistarCuenta() {
  return (
    <div className="registro-container">
      <div className="registro-card">
        <h2>Crear una cuenta</h2>

        <div className="form-group">
          <label>Nombre completo</label>
          <input
            type="text"
            className="registro-input"
            placeholder="Tu nombre"
          />
        </div>

        <div className="form-group">
          <label>Dirección</label>
          <input
            type="text"
            className="registro-input"
            placeholder="Tu dirección"
          />
        </div>

        <div className="form-group">
          <label>Número de teléfono</label>
          <input
            type="text"
            className="registro-input"
            placeholder="10 dígitos"
          />
        </div>

        <div className="form-group">
          <label>Correo Electrónico</label>
          <input
            type="email"
            className="registro-input"
            placeholder="correo@ejemplo.com"
          />
        </div>

        <div className="form-group">
          <label>RFC</label>
          <input type="text" className="registro-input" placeholder="Tu RFC" />
        </div>

        <div className="form-group">
          <label>Identificación Oficial por ambos lados (INE)</label>
          <div className="file-inputs">
            <div>
              <span className="file-label">Frente:</span>
              <input type="file" />
            </div>
            <div>
              <span className="file-label">Reverso:</span>
              <input type="file" />
            </div>
          </div>
        </div>

        <div className="form-group">
          <label>Contraseña</label>
          <input
            type="password"
            className="registro-input"
            placeholder="Contraseña"
          />
        </div>

        <div className="requisitos-box">
          <p className="requisitos-titulo">
            Tu contraseña debe tener los siguientes requisitos:
          </p>
          <ul>
            <li>Entre 10 a 15 Caracteres</li>
            <li>Al menos una letra mayúscula</li>
            <li>Al menos una letra minúscula</li>
            <li>Al menos un número</li>
            <li>Al menos un carácter especial (!, @, #, $, %, &, *, -, _)</li>
          </ul>
        </div>

        <Boton texto="Registrarse" onClick={() => {}} />
      </div>
    </div>
  );
}

export default RegistarCuenta;
