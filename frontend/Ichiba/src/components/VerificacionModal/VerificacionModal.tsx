import { useState, useEffect } from "react";
import {
  enviarCodigoCorreo,
  verificarCodigoCorreo,
} from "../../services/verificacionService";
import "./VerificacionModal.css";

interface VerificacionModalProps {
  onCompletado: () => void;
}

function VerificacionModal({ onCompletado }: VerificacionModalProps) {
  const [correoVerificado, setCorreoVerificado] = useState(false);
  const [codigoCorreo, setCodigoCorreo] = useState("");
  const [errorCorreo, setErrorCorreo] = useState("");
  const [enviandoCorreo, setEnviandoCorreo] = useState(false);
  const [correoEnviado, setCorreoEnviado] = useState(false);

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
          Para proteger a los compradores, necesitamos confirmar tu correo antes
          de que puedas vender en Ichiba.
        </p>

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
