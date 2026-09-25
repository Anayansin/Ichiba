import { URL_BACKEND } from "../../services/api";
import "./BurbujaDeTexto.css";

interface BurbujaDeTextoProps {
  contenido: string;
  esRemitente: boolean;
  horario: string;
  estadoLectura: "enviedo" | "recivido" | "leido";
  imagen?: string | null;
}

function obtenerCheckLectura(estado: string) {
  if (estado === "leido") return "✓✓";
  if (estado === "recibido") return "✓✓";
  return "✓";
}

function BurbujaDeTexto({
  contenido,
  esRemitente,
  horario,
  estadoLectura,
  imagen,
}: BurbujaDeTextoProps) {
  const claseAlineacion = esRemitente ? "mensaje-mio" : "mensaje-otro";
  const tieneImagen = !!imagen;
  const tieneTexto = !!contenido.trim();

  return (
    <div className={`contenedor-burbuja ${claseAlineacion}`}>
      <div className={`burbuja ${tieneImagen ? "burbuja--con-imagen" : ""}`}>
        {tieneImagen && (
          <img
            className="burbuja__imagen"
            src={`${URL_BACKEND}${imagen}`}
            alt="Imagen adjunta"
          />
        )}
        {tieneTexto && <div className="burbuja__contenido">{contenido}</div>}
        <div className="burbuja__metadatos">
          <span className="burbuja__horario">{horario}</span>
          {esRemitente && (
            <span className={`burbuja__estado ${estadoLectura}`}>
              {obtenerCheckLectura(estadoLectura)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default BurbujaDeTexto;
