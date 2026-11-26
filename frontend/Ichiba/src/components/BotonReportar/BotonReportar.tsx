import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  CATEGORIAS_REPORTE,
  ELEMENTOS_REPORTE,
  type ElementoReporte,
} from "../../configuracion/categoriasReporte";
import {
  crearReporte,
  type DatosReporte,
  type RespuestaReporte,
} from "../../services/reporteService";
import { mensajeDeError } from "../../utils/errores";
import "./BotonReportar.css";

const DETALLE_MINIMO = 30;
const DETALLE_MAXIMO = 500;

type Props = {
  elemento?: ElementoReporte;
  elementos?: ElementoReporte[];
  ventaId?: string;
  productoId?: string;
  promocionalId?: string;
  vendedorId?: string;
  mensajeId?: string;
  origenMensaje?: DatosReporte["origenMensaje"];
  texto?: string;
  className?: string;
  abiertoExterno?: boolean;
  onCerrar?: () => void;
  sinBoton?: boolean;
};

function textoEstado(estado: RespuestaReporte["estado"]): string {
  if (estado === "pendiente") return "En revisión por un administrador";
  if (estado === "confirmado") return "Registrado y aplicado";
  return "Rechazado";
}

function BotonReportar({
  elemento,
  elementos,
  ventaId,
  productoId,
  promocionalId,
  vendedorId,
  mensajeId,
  origenMensaje,
  texto = "Reportar",
  className,
  abiertoExterno,
  onCerrar,
  sinBoton,
}: Props) {
  const opciones = ELEMENTOS_REPORTE.filter((opcion) =>
    elementos ? elementos.includes(opcion.id) : opcion.id === elemento,
  );
  const [abierto, setAbierto] = useState(false);
  const [elegido, setElegido] = useState<ElementoReporte>(
    opciones[0]?.id ?? "vendedor",
  );
  const [categoria, setCategoria] = useState(CATEGORIAS_REPORTE[0].id);
  const [detalle, setDetalle] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [resultado, setResultado] = useState<RespuestaReporte | null>(null);

  const longitud = detalle.trim().length;
  const detalleValido = longitud >= DETALLE_MINIMO && longitud <= DETALLE_MAXIMO;

  function abrir() {
    setError("");
    setResultado(null);
    setDetalle("");
    setCategoria(CATEGORIAS_REPORTE[0].id);
    setElegido(opciones[0]?.id ?? "vendedor");
    setAbierto(true);
  }

  function cerrar() {
    setAbierto(false);
    onCerrar?.();
  }

  useEffect(() => {
    if (abiertoExterno) abrir();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abiertoExterno]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!detalleValido) return;
    setEnviando(true);
    setError("");
    try {
      const respuesta = await crearReporte({
        elemento: elegido,
        categoria,
        detalle: detalle.trim(),
        ventaId,
        productoId,
        promocionalId,
        vendedorId,
        mensajeId,
        origenMensaje,
      });
      setResultado(respuesta);
    } catch (err) {
      setError(mensajeDeError(err) || "No se pudo enviar el reporte");
    } finally {
      setEnviando(false);
    }
  }

  const modal = abierto ? (
    <div className="reportar-modal__fondo" onClick={cerrar}>
      <div
        className="reportar-modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <h3>{texto}</h3>
        {resultado ? (
          <>
            <p className="reportar-modal__exito">{resultado.message}</p>
            <p className="reportar-modal__estado">
              Estado del reporte: <strong>{textoEstado(resultado.estado)}</strong>
            </p>
            <div className="reportar-modal__acciones">
              <button
                type="button"
                className="reportar-modal__enviar"
                onClick={cerrar}
              >
                Aceptar
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={enviar}>
            <label>
              ¿Qué quieres reportar?
              <select
                value={elegido}
                onChange={(e) => setElegido(e.target.value as ElementoReporte)}
                disabled={opciones.length < 2}
              >
                {opciones.map((opcion) => (
                  <option key={opcion.id} value={opcion.id}>
                    {opcion.nombre}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Categoría
              <select
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
              >
                {CATEGORIAS_REPORTE.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.nombre}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Detalle
              <textarea
                rows={4}
                maxLength={DETALLE_MAXIMO}
                value={detalle}
                onChange={(e) => setDetalle(e.target.value)}
                placeholder="Describe lo que sucedió (mínimo 30 caracteres)"
              />
              <span
                className={`reportar-modal__contador ${detalleValido ? "" : "reportar-modal__contador--falta"}`}
              >
                {longitud}/{DETALLE_MAXIMO}
              </span>
            </label>

            {error && <p className="reportar-modal__error">{error}</p>}

            <div className="reportar-modal__acciones">
              <button
                type="button"
                className="reportar-modal__cancelar"
                onClick={cerrar}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="reportar-modal__enviar"
                disabled={enviando || !detalleValido}
              >
                {enviando ? "Enviando..." : "Enviar reporte"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  ) : null;

  return (
    <>
      {!sinBoton && (
        <button
          type="button"
          className={className ?? "boton-reportar"}
          onClick={abrir}
        >
          {texto}
        </button>
      )}
      {modal && createPortal(modal, document.body)}
    </>
  );
}

export default BotonReportar;
