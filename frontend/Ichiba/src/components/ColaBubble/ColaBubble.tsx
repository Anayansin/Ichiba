import { useState } from "react";
import { useColas } from "../../context/ColasContext";
import { salirDeFila } from "../../services/colaService";
import { URL_BACKEND } from "../../services/api";
import { mensajeDeError } from "../../utils/errores";
import "./ColaBubble.css";

function ColaBubble() {
  const { filas, cantidadFilas, recargarFilas } = useColas();
  const [abierto, setAbierto] = useState(false);
  const [error, setError] = useState("");

  if (cantidadFilas === 0) return null;

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
    <div className="cola-bubble">
      {abierto && (
        <div className="cola-bubble__panel">
          <p className="cola-bubble__titulo">
            Tus filas activas ({cantidadFilas}/3)
          </p>
          {error && <p className="cola-bubble__error">{error}</p>}
          {filas.map((fila) => {
            // Defensa: si el producto fue borrado, populate devuelve null
            if (!fila.productoId) return null;

            return (
              <div key={fila._id} className="cola-bubble__item">
                <img
                  src={`${URL_BACKEND}${fila.productoId.imagenes?.[0] ?? ""}`}
                  alt={fila.productoId.nombre}
                />
                <div className="cola-bubble__item-info">
                  <p>{fila.productoId.nombre}</p>
                  <span>${fila.productoId.precio}</span>
                </div>
                <button onClick={() => handleSalir(fila._id)}>Salir</button>
              </div>
            );
          })}
        </div>
      )}

      <button
        className="cola-bubble__circulo"
        onClick={() => setAbierto(!abierto)}
      >
        {cantidadFilas}
      </button>
    </div>
  );
}

export default ColaBubble;
