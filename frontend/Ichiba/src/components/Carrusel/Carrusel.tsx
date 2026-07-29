import { useState } from "react";
import "./Carrusel.css";

interface CarruselProps {
  imagenes: string[];
  alt: string;
}

function Carrusel({ imagenes, alt }: CarruselProps) {
  const [indiceActual, setIndiceActual] = useState(0);

  const irAnterior = () => {
    setIndiceActual((prev) => (prev === 0 ? imagenes.length - 1 : prev - 1));
  };

  const irSiguiente = () => {
    setIndiceActual((prev) => (prev === imagenes.length - 1 ? 0 : prev + 1));
  };

  const hayMasDeUnaImagen = imagenes.length > 1;

  return (
    <div className="carrusel">
      {hayMasDeUnaImagen && (
        <button
          className="carrusel__flecha carrusel__flecha--izquierda"
          onClick={irAnterior}
          aria-label="Imagen anterior"
        >
          ‹
        </button>
      )}

      <div className="carrusel__imagen-wrapper">
        <img
          src={imagenes[indiceActual]}
          alt={`${alt} - imagen ${indiceActual + 1}`}
          className="carrusel__imagen"
        />
      </div>

      {hayMasDeUnaImagen && (
        <button
          className="carrusel__flecha carrusel__flecha--derecha"
          onClick={irSiguiente}
          aria-label="Siguiente imagen"
        >
          ›
        </button>
      )}

      {hayMasDeUnaImagen && (
        <div className="carrusel__indicadores">
          {imagenes.map((_, index) => (
            <button
              key={index}
              className={`carrusel__punto ${
                index === indiceActual ? "carrusel__punto--activo" : ""
              }`}
              onClick={() => setIndiceActual(index)}
              aria-label={`Ir a imagen ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default Carrusel;
