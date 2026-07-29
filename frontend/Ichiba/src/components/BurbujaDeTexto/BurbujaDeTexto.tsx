import "./BurbujaDeTexto.css";

interface BurbujaDeTextoProps {
  contenido: string;
  esRemitente: boolean;
  horario: string;
  estadoLectura: "enviedo" | "recivido" | "leido";
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
}: BurbujaDeTextoProps) {
  const claseAlineacion = esRemitente ? "mensaje-mio" : "mensaje-otro";

  return (
    <div className={`contenedor-burbuja ${claseAlineacion}`}>
      <div className="burbuja">
        <div className="burbuja__contenido">{contenido}</div>
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
