import { useState } from "react";
import "./RegistrarCuenta.css";
import Boton from "../../components/Boton/Boton";
import VerificacionModal from "../../components/VerificacionModal/VerificacionModal";
import { registrarUsuario } from "../../services/usuarioServices";
import {
  validarDimensionesImagen,
  validarFormatoImagen,
} from "../../utils/validarImagen";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";

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

function RegistarCuenta() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [nombreCompleto, setNombreCompleto] = useState("");
  const [direccion, setDireccion] = useState("");
  const [telefono, setTelefono] = useState("");
  const [correo, setCorreo] = useState("");
  const [rfc, setRfc] = useState("");
  const [password, setPassword] = useState("");
  const [aceptaTerminos, setAceptaTerminos] = useState(false);
  const [recibirNotificaciones, setRecibirNotificaciones] = useState(false);

  const [ineFrente, setIneFrente] = useState<File | null>(null);
  const [ineReverso, setIneReverso] = useState<File | null>(null);
  const [errorIneFrente, setErrorIneFrente] = useState("");
  const [errorIneReverso, setErrorIneReverso] = useState("");

  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const [mostrarVerificacion, setMostrarVerificacion] = useState(false);

  function handleTelefonoChange(valor: string) {
    const soloNumeros = valor.replace(/\D/g, "").slice(0, 10);
    setTelefono(soloNumeros);
  }

  async function handleArchivoIne(
    e: React.ChangeEvent<HTMLInputElement>,
    lado: "frente" | "reverso",
  ) {
    const archivo = e.target.files?.[0];
    if (!archivo) return;

    const setArchivo = lado === "frente" ? setIneFrente : setIneReverso;
    const setErrorArchivo =
      lado === "frente" ? setErrorIneFrente : setErrorIneReverso;

    setErrorArchivo("");

    if (!validarFormatoImagen(archivo)) {
      setErrorArchivo("Solo se permiten imágenes .png, .jpg o .jpeg");
      setArchivo(null);
      e.target.value = "";
      return;
    }

    const dimensionesOk = await validarDimensionesImagen(archivo);
    if (!dimensionesOk) {
      setErrorArchivo("La imagen debe medir al menos 420x540 píxeles");
      setArchivo(null);
      e.target.value = "";
      return;
    }

    setArchivo(archivo);
  }

  const passwordValida = requisitosPassword.every((req) => req.test(password));
  const telefonoValido = telefono.length === 10;

  const formularioCompleto =
    nombreCompleto.trim() !== "" &&
    direccion.trim() !== "" &&
    telefonoValido &&
    correo.trim() !== "" &&
    rfc.trim() !== "" &&
    passwordValida &&
    aceptaTerminos &&
    recibirNotificaciones &&
    ineFrente !== null &&
    ineReverso !== null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!formularioCompleto || !ineFrente || !ineReverso) {
      setError("Completa todos los campos y requisitos antes de continuar");
      return;
    }

    setCargando(true);

    try {
      const data = await registrarUsuario({
        nombreCompleto,
        direccion,
        telefono,
        correo,
        rfc,
        password,
        aceptaTerminos,
        recibirNotificacionesCriticas: recibirNotificaciones,
        ineFrente,
        ineReverso,
      });

      login(data.usuario, data.token);
      setMostrarVerificacion(true);
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
            placeholder="Tu nombre, tal como aparece en tu INE"
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
          <label>Número de teléfono (10 dígitos)</label>
          <input
            type="text"
            inputMode="numeric"
            className="registro-input"
            placeholder="3312345678"
            value={telefono}
            onChange={(e) => handleTelefonoChange(e.target.value)}
            required
          />
          {telefono.length > 0 && !telefonoValido && (
            <span className="registro-campo-error">
              Debe tener exactamente 10 dígitos
            </span>
          )}
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
              <input
                type="file"
                accept="image/png, image/jpeg"
                onChange={(e) => handleArchivoIne(e, "frente")}
              />
              {errorIneFrente && (
                <span className="registro-campo-error">{errorIneFrente}</span>
              )}
            </div>
            <div>
              <span className="file-label">Reverso:</span>
              <input
                type="file"
                accept="image/png, image/jpeg"
                onChange={(e) => handleArchivoIne(e, "reverso")}
              />
              {errorIneReverso && (
                <span className="registro-campo-error">{errorIneReverso}</span>
              )}
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
          <p className="requisitos-titulo">Tu contraseña debe cumplir:</p>
          <ul>
            {requisitosPassword.map((req) => (
              <li
                key={req.texto}
                className={req.test(password) ? "requisito-cumplido" : ""}
              >
                {req.test(password) ? "✓" : "○"} {req.texto}
              </li>
            ))}
          </ul>
        </div>

        <label className="registro-checkbox">
          <input
            type="checkbox"
            checked={aceptaTerminos}
            onChange={(e) => setAceptaTerminos(e.target.checked)}
          />
          Acepto los términos y condiciones de Ichiba
        </label>

        <label className="registro-checkbox">
          <input
            type="checkbox"
            checked={recibirNotificaciones}
            onChange={(e) => setRecibirNotificaciones(e.target.checked)}
          />
          Acepto recibir notificaciones críticas sobre mi cuenta, la fila
          virtual y mis pagos
        </label>

        <Boton
          texto={cargando ? "Registrando..." : "Registrarse"}
          onClick={() => {}}
          type="submit"
        />
      </form>

      {mostrarVerificacion && (
        <VerificacionModal onCompletado={() => navigate("/panel-vendedor")} />
      )}
    </div>
  );
}

export default RegistarCuenta;
