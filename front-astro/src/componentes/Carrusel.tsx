import { useState } from "react";
import { URL_BACKEND } from "../servicios/api";
import "./Carrusel.css";

interface PropiedadesDeCarrusel {
  imagenes: string[];
  alt: string;
}

function Carrusel({ imagenes, alt }: PropiedadesDeCarrusel) {
  const [indiceActual, setIndiceActual] = useState(0);

  const irAnterior = () => {
    setIndiceActual((anterior) =>
      anterior === 0 ? imagenes.length - 1 : anterior - 1,
    );
  };

  const irSiguiente = () => {
    setIndiceActual((anterior) =>
      anterior === imagenes.length - 1 ? 0 : anterior + 1,
    );
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

      <div className="carrusel__contenedor-imagen">
        <img
          src={`${URL_BACKEND}${imagenes[indiceActual]}`}
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
          {imagenes.map((_, indice) => (
            <button
              key={indice}
              className={`carrusel__punto ${
                indice === indiceActual ? "carrusel__punto--activo" : ""
              }`}
              onClick={() => setIndiceActual(indice)}
              aria-label={`Ir a imagen ${indice + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default Carrusel;
