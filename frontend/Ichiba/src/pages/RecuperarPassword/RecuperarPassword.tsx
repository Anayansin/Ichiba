import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Boton from "../../components/Boton/Boton";
import {
  solicitarRecuperacion,
  restablecerPassword,
} from "../../services/usuarioServices";
import { mensajeDeError } from "../../utils/errores";
import "./RecuperarPassword.css";

const requisitosPassword = [
  {
    texto: "Entre 10 y 15 caracteres",
    test: (p: string) => p.length >= 10 && p.length <= 15,
  },
  {
    texto: "Al menos una letra mayúscula",
    test: (p: string) => /[A-Z]/.test(p),
  },
  {
    texto: "Al menos una letra minúscula",
    test: (p: string) => /[a-z]/.test(p),
  },
  { texto: "Al menos un número", test: (p: string) => /[0-9]/.test(p) },
  {
    texto: "Al menos un carácter especial (!@#$%&*-_)",
    test: (p: string) => /[!@#$%&*\-_]/.test(p),
  },
];

function RecuperarPassword() {
  const navigate = useNavigate();
  const [paso, setPaso] = useState<"correo" | "codigo">("correo");
  const [correo, setCorreo] = useState("");
  const [codigo, setCodigo] = useState("");
  const [passwordNueva, setPasswordNueva] = useState("");
  const [passwordConfirmar, setPasswordConfirmar] = useState("");
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(false);

  const passwordValida = requisitosPassword.every((req) =>
    req.test(passwordNueva),
  );
  const passwordsCoinciden = passwordNueva === passwordConfirmar;
  const formularioValido =
    correo.trim() !== "" && codigo.trim() !== "" && passwordValida && passwordsCoinciden;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (paso === "correo") {
      if (!correo.trim()) {
        setError("El correo es obligatorio");
        return;
      }

      setCargando(true);
      try {
        const data = await solicitarRecuperacion(correo);
        setMensaje(data.message);
        setPaso("codigo");
      } catch (err) {
        setError(
          mensajeDeError(err) || "No se pudo enviar el correo",
        );
      } finally {
        setCargando(false);
      }
    } else {
      if (!codigo.trim() || !passwordNueva || !passwordConfirmar) {
        setError("Completa todos los campos");
        return;
      }

      if (!passwordValida) {
        setError("La contraseña no cumple con los requisitos");
        return;
      }

      if (!passwordsCoinciden) {
        setError("Las contraseñas no coinciden");
        return;
      }

      setCargando(true);
      try {
        await restablecerPassword(correo, codigo, passwordNueva);
        navigate("/");
      } catch (err) {
        setError(
          mensajeDeError(err) || "Error al restablecer la contraseña",
        );
      } finally {
        setCargando(false);
      }
    }
  }

  return (
    <div className="recuperar-container">
      <form className="recuperar-card" onSubmit={handleSubmit}>
        <h2>Recuperar contraseña</h2>

        {error && <p className="recuperar-error">{error}</p>}
        {mensaje && <p className="recuperar-mensaje">{mensaje}</p>}

        <div className="form-group">
          <label>Correo electrónico</label>
          <input
            type="email"
            className="recuperar-input"
            placeholder="correo@ejemplo.com"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            required
            disabled={paso === "codigo"}
          />
        </div>

        {paso === "codigo" && (
          <>
            <div className="form-group">
              <label>Código de 4 dígitos</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={4}
                className="recuperar-input recuperar-input-codigo"
                placeholder="1234"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
                required
              />
            </div>

            <div className="form-group">
              <label>Nueva contraseña</label>
              <input
                type="password"
                className="recuperar-input"
                placeholder="Nueva contraseña"
                value={passwordNueva}
                onChange={(e) => setPasswordNueva(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>Confirmar contraseña</label>
              <input
                type="password"
                className="recuperar-input"
                placeholder="Repite tu nueva contraseña"
                value={passwordConfirmar}
                onChange={(e) => setPasswordConfirmar(e.target.value)}
                required
              />
            </div>

            <div className="requisitos-box">
              <p className="requisitos-titulo">Tu contraseña debe cumplir:</p>
              <ul>
                {requisitosPassword.map((req) => (
                  <li
                    key={req.texto}
                    className={req.test(passwordNueva) ? "requisito-cumplido" : ""}
                  >
                    {req.test(passwordNueva) ? "✓" : "○"} {req.texto}
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}

        <Boton
          texto={
            cargando
              ? "Procesando..."
              : paso === "correo"
                ? "Enviar código"
                : "Guardar contraseña"
          }
          onClick={() => {}}
          type="submit"
          disabled={cargando || (paso === "codigo" && !formularioValido)}
        />
      </form>
    </div>
  );
}

export default RecuperarPassword;
