import { useState, useEffect } from "react";
import {
  enviarCodigoTelefono,
  verificarCodigoTelefono,
  enviarCodigoCorreo,
  verificarCodigoCorreo,
} from "../../services/verificacionService";
import "./VerificacionModal.css";

interface VerificacionModalProps {
  onCompletado: () => void;
}

function VerificacionModal({ onCompletado }: VerificacionModalProps) {
  const [telefonoVerificado, setTelefonoVerificado] = useState(false);
  const [correoVerificado, setCorreoVerificado] = useState(false);

  const [codigoTelefono, setCodigoTelefono] = useState("");
  const [codigoCorreo, setCodigoCorreo] = useState("");

  const [errorTelefono, setErrorTelefono] = useState("");
  const [errorCorreo, setErrorCorreo] = useState("");

  const [enviandoTelefono, setEnviandoTelefono] = useState(false);
  const [enviandoCorreo, setEnviandoCorreo] = useState(false);

  const [smsEnviado, setSmsEnviado] = useState(false);
  const [correoEnviado, setCorreoEnviado] = useState(false);

  useEffect(() => {
    if (telefonoVerificado && correoVerificado) {
      onCompletado();
    }
  }, [telefonoVerificado, correoVerificado, onCompletado]);

  async function handleEnviarSMS() {
    setEnviandoTelefono(true);
    setErrorTelefono("");
    try {
      await enviarCodigoTelefono();
      setSmsEnviado(true);
    } catch (err: any) {
      setErrorTelefono(err.response?.data?.message || "Error al enviar el SMS");
    } finally {
      setEnviandoTelefono(false);
    }
  }

  async function handleVerificarTelefono() {
    setErrorTelefono("");
    try {
      await verificarCodigoTelefono(codigoTelefono);
      setTelefonoVerificado(true);
    } catch (err: any) {
      setErrorTelefono(err.response?.data?.message || "Código incorrecto");
    }
  }

  async function handleEnviarCorreo() {
    setEnviandoCorreo(true);
    setErrorCorreo("");
    try {
      await enviarCodigoCorreo();
      setCorreoEnviado(true);
    } catch (err: any) {
      setErrorCorreo(
        err.response?.data?.message || "Error al enviar el correo",
      );
    } finally {
      setEnviandoCorreo(false);
    }
  }

  async function handleVerificarCorreo() {
    setErrorCorreo("");
    try {
      await verificarCodigoCorreo(codigoCorreo);
      setCorreoVerificado(true);
    } catch (err: any) {
      setErrorCorreo(err.response?.data?.message || "Código incorrecto");
    }
  }

  return (
    <div className="modal-overlay">
      <div className="verificacion-modal">
        <h2>Verifica tu cuenta</h2>
        <p className="verificacion-modal__intro">
          Para proteger a los compradores, necesitamos confirmar tu teléfono y
          correo antes de que puedas vender en Ichiba.
        </p>

        <div
          className={`verificacion-bloque ${telefonoVerificado ? "verificacion-bloque--ok" : ""}`}
        >
          <p className="verificacion-bloque__titulo">
            Teléfono {telefonoVerificado && "✓"}
          </p>

          {!telefonoVerificado && (
            <>
              {!smsEnviado ? (
                <button
                  className="verificacion-btn-enviar"
                  onClick={handleEnviarSMS}
                  disabled={enviandoTelefono}
                >
                  {enviandoTelefono ? "Enviando..." : "Enviar código por SMS"}
                </button>
              ) : (
                <div className="verificacion-input-grupo">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="0000"
                    className="verificacion-input"
                    value={codigoTelefono}
                    onChange={(e) =>
                      setCodigoTelefono(e.target.value.replace(/\D/g, ""))
                    }
                  />
                  <button
                    className="verificacion-btn-verificar"
                    onClick={handleVerificarTelefono}
                  >
                    Verificar
                  </button>
                </div>
              )}
              {errorTelefono && (
                <p className="verificacion-error">{errorTelefono}</p>
              )}
            </>
          )}
        </div>

        <div
          className={`verificacion-bloque ${correoVerificado ? "verificacion-bloque--ok" : ""}`}
        >
          <p className="verificacion-bloque__titulo">
            Correo electrónico {correoVerificado && "✓"}
          </p>

          {!correoVerificado && (
            <>
              {!correoEnviado ? (
                <button
                  className="verificacion-btn-enviar"
                  onClick={handleEnviarCorreo}
                  disabled={enviandoCorreo}
                >
                  {enviandoCorreo ? "Enviando..." : "Enviar código por correo"}
                </button>
              ) : (
                <div className="verificacion-input-grupo">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="0000"
                    className="verificacion-input"
                    value={codigoCorreo}
                    onChange={(e) =>
                      setCodigoCorreo(e.target.value.replace(/\D/g, ""))
                    }
                  />
                  <button
                    className="verificacion-btn-verificar"
                    onClick={handleVerificarCorreo}
                  >
                    Verificar
                  </button>
                </div>
              )}
              {errorCorreo && (
                <p className="verificacion-error">{errorCorreo}</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default VerificacionModal;
