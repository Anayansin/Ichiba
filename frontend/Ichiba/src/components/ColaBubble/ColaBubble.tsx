import { useState } from "react";
import { useColas } from "../../context/ColasContext";
import { salirDeFila } from "../../services/colaService";
import { URL_BACKEND } from "../../services/api";
import { mensajeDeError } from "../../utils/errores";
import "./ColaBubble.css";

const TEXTO_ESTADO: Record<string, string> = {
  activa: "",
  esperando_apertura: "Esperando el siguiente bloque del vendedor",
  esperando_confirmacion: "En pausa: otro comprador está completando su pago",
  pagada: "Pagaste: registra tu comprobante",
  reposo: "Comprobante en revisión por el vendedor",
};

const TEXTO_AVISO: Record<string, string> = {
  vendido_a_otro: "Producto no disponible: un usuario previo ha concretado la compra",
  cuenta_cancelada:
    "Producto no disponible: la cuenta del vendedor fue cancelada y saliste de la fila",
  turno_vencido:
    "Fuiste retirado de la fila: no realizaste el pago dentro del tiempo establecido",
  comprobante_rechazado:
    "Fuiste retirado de la fila: el vendedor rechazó tu comprobante de pago",
  venta_cancelada:
    "Tu compra fue cancelada y saliste de la fila. Revisa «Mis pedidos» para ver el motivo y el reembolso",
  producto_eliminado: "Producto no disponible: la publicación fue dada de baja",
};

function ColaBubble() {
  const { filas, cantidadFilas, recargarFilas, avisos, descartarAviso } =
    useColas();
  const [abierto, setAbierto] = useState(false);
  const [error, setError] = useState("");

  const aviso = avisos[0];

  async function handleSalir(id: string) {
    try {
      await salirDeFila(id);
      setError("");
      recargarFilas();
    } catch (err) {
      setError(mensajeDeError(err) || "No pudimos sacarte de la fila");
    }
  }

  return (
    <>
      {aviso && (
        <div className="cola-aviso__fondo" role="alertdialog" aria-modal="true">
          <div className="cola-aviso">
            {aviso.producto && (
              <p className="cola-aviso__producto">{aviso.producto}</p>
            )}
            <p className="cola-aviso__mensaje">
              {TEXTO_AVISO[aviso.motivoCierre] ?? "Saliste de la fila"}
            </p>
            <button
              type="button"
              className="cola-aviso__aceptar"
              onClick={() => descartarAviso(aviso._id)}
            >
              Aceptar
            </button>
          </div>
        </div>
      )}

      {cantidadFilas > 0 && (
        <div className="cola-bubble">
          {abierto && (
            <div className="cola-bubble__panel">
              <p className="cola-bubble__titulo">
                Tus filas activas ({cantidadFilas}/3)
              </p>
              {error && <p className="cola-bubble__error">{error}</p>}
              {filas.map((fila) => {
                if (!fila.productoId) return null;

                return (
                  <div key={fila._id} className="cola-bubble__item">
                    <img
                      src={`${URL_BACKEND}${fila.productoId.imagenes?.[0] ?? ""}`}
                      alt={fila.productoId.nombre}
                    />
                    <div className="cola-bubble__item-info">
                      <p>{fila.productoId.nombre}</p>
                      <span className="cola-bubble__posicion">
                        Posición {fila.posicion}
                      </span>
                      {TEXTO_ESTADO[fila.estado] && (
                        <span className="cola-bubble__espera">
                          {TEXTO_ESTADO[fila.estado]}
                        </span>
                      )}
                    </div>
                    {fila.estado !== "pagada" && fila.estado !== "reposo" && (
                      <button onClick={() => handleSalir(fila._id)}>Salir</button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <button
            className="cola-bubble__circulo"
            onClick={() => setAbierto(!abierto)}
            aria-label="Ver mis filas"
          >
            {cantidadFilas}
          </button>
        </div>
      )}
    </>
  );
}

export default ColaBubble;
