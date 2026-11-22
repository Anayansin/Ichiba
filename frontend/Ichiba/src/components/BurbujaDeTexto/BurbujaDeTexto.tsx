import "./BurbujaDeTexto.css";

interface BurbujaDeTextoProps {
  contenido: string;
  esRemitente: boolean;
  emisor: string;
  horario: string;
}

function BurbujaDeTexto({
  contenido,
  esRemitente,
  emisor,
  horario,
}: BurbujaDeTextoProps) {
  const claseAlineacion = esRemitente ? "mensaje-mio" : "mensaje-otro";

  return (
    <div className={`contenedor-burbuja ${claseAlineacion}`}>
      <div className="burbuja">
        <div className="burbuja__emisor">{emisor}</div>
        <div className="burbuja__contenido">{contenido}</div>
        <div className="burbuja__metadatos">
          <span className="burbuja__horario">{horario}</span>
        </div>
      </div>
    </div>
  );
}

export default BurbujaDeTexto;
