import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./RegistrarCuenta.css";
import Boton from "../../components/Boton/Boton";
import { registrarUsuario } from "../../services/usuarioServices";

function RegistarCuenta() {
  const navigate = useNavigate();

  const [nombreCompleto, setNombreCompleto] = useState("");
  const [direccion, setDireccion] = useState("");
  const [telefono, setTelefono] = useState("");
  const [correo, setCorreo] = useState("");
  const [rfc, setRfc] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setCargando(true);

    try {
      await registrarUsuario({
        nombreCompleto,
        direccion,
        telefono,
        correo,
        rfc,
        password,
      });

      navigate("/inicio");
    } catch (err: any) {
      const mensaje =
        err.response?.data?.message || "Error al registrar la cuenta";
      setError(mensaje);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="registro-container">
      <form className="registro-card" onSubmit={handleSubmit}>
        <h2>Crear una cuenta</h2>

        {error && <p className="registro-error">{error}</p>}

        <div className="form-group">
          <label>Nombre completo</label>
          <input
            type="text"
            className="registro-input"
            placeholder="Tu nombre"
            value={nombreCompleto}
            onChange={(e) => setNombreCompleto(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label>Dirección</label>
          <input
            type="text"
            className="registro-input"
            placeholder="Tu dirección"
            value={direccion}
            onChange={(e) => setDireccion(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label>Número de teléfono</label>
          <input
            type="text"
            className="registro-input"
            placeholder="10 dígitos"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label>Correo Electrónico</label>
          <input
            type="email"
            className="registro-input"
            placeholder="correo@ejemplo.com"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label>RFC</label>
          <input
            type="text"
            className="registro-input"
            placeholder="Tu RFC"
            value={rfc}
            onChange={(e) => setRfc(e.target.value)}
            required
          />
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
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
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

        <Boton
          texto={cargando ? "Registrando..." : "Registrarse"}
          onClick={() => {}}
          type="submit"
        />
      </form>
    </div>
  );
}

export default RegistarCuenta;
