import { useState } from "react";
import type { FormEvent } from "react";
import { useAuth } from "../../context/AuthContext";
import { ASUNTOS_QUEJA, enviarQueja } from "../../services/adminTotalService";
import { mensajeDeError } from "../../utils/errores";
import "./EnviarQueja.css";

const MINIMO = 20;
const MAXIMO = 1000;

function EnviarQueja() {
  const { usuario } = useAuth();
  const [asunto, setAsunto] = useState(ASUNTOS_QUEJA[0].id);
  const [mensaje, setMensaje] = useState("");
  const [referencia, setReferencia] = useState("");
  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [enviada, setEnviada] = useState("");

  const longitud = mensaje.trim().length;
  const valido = longitud >= MINIMO && longitud <= MAXIMO;

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (!valido) return;
    setEnviando(true);
    setError("");
    try {
      const respuesta = await enviarQueja({
        asunto,
        mensaje: mensaje.trim(),
        referencia: referencia.trim() || undefined,
        ...(usuario ? {} : { nombre: nombre.trim(), correo: correo.trim() }),
      });
      setEnviada(respuesta.message);
      setMensaje("");
      setReferencia("");
    } catch (err) {
      setError(mensajeDeError(err) || "No se pudo enviar tu queja");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="enviar-queja">
      <h2>Enviar una queja</h2>

      {enviada ? (
        <div className="enviar-queja__exito">
          <p>{enviada}</p>
          <button type="button" onClick={() => setEnviada("")}>
            Enviar otra
          </button>
        </div>
      ) : (
        <form onSubmit={enviar}>
          <label>
            Tema
            <select value={asunto} onChange={(e) => setAsunto(e.target.value)}>
              {ASUNTOS_QUEJA.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre}
                </option>
              ))}
            </select>
          </label>

          <label>
            Producto o número de venta (opcional)
            <input
              type="text"
              maxLength={120}
              value={referencia}
              onChange={(e) => setReferencia(e.target.value)}
            />
          </label>

          {!usuario && (
            <div className="enviar-queja__fila">
              <label>
                Tu nombre (opcional)
                <input
                  type="text"
                  maxLength={120}
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                />
              </label>
              <label>
                Correo para responderte (opcional)
                <input
                  type="email"
                  value={correo}
                  onChange={(e) => setCorreo(e.target.value)}
                />
              </label>
            </div>
          )}

          <label>
            ¿Qué pasó?
            <textarea
              rows={6}
              maxLength={MAXIMO}
              value={mensaje}
              onChange={(e) => setMensaje(e.target.value)}
              placeholder={`Mínimo ${MINIMO} caracteres`}
            />
            <span
              className={`enviar-queja__contador ${valido ? "" : "enviar-queja__contador--falta"}`}
            >
              {longitud}/{MAXIMO}
            </span>
          </label>

          {error && <p className="enviar-queja__error">{error}</p>}

          <button
            type="submit"
            className="enviar-queja__enviar"
            disabled={!valido || enviando}
          >
            {enviando ? "Enviando..." : "Enviar queja"}
          </button>
        </form>
      )}
    </section>
  );
}

export default EnviarQueja;
