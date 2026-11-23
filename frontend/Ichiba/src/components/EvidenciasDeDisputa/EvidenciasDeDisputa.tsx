import { useEffect, useState } from "react";
import { fetchEvidenciaDisputa } from "../../services/pagoService";

interface EvidenciasDeDisputaProps {
  disputaId: string;
  lado: "comprador" | "vendedor";
  cantidad: number;
  className: string;
}

function EvidenciasDeDisputa({
  disputaId,
  lado,
  cantidad,
  className,
}: EvidenciasDeDisputaProps) {
  const [urls, setUrls] = useState<string[]>([]);

  useEffect(() => {
    if (cantidad === 0) {
      setUrls([]);
      return;
    }
    let activo = true;
    const creadas: string[] = [];
    (async () => {
      for (let indice = 0; indice < cantidad; indice += 1) {
        try {
          const url = await fetchEvidenciaDisputa(disputaId, lado, indice);
          creadas.push(url);
          if (activo) setUrls([...creadas]);
        } catch {
          // Una evidencia que no se pudo descargar simplemente no se muestra.
        }
      }
    })();
    return () => {
      activo = false;
      for (const url of creadas) URL.revokeObjectURL(url);
    };
  }, [disputaId, lado, cantidad]);

  if (cantidad === 0) return null;

  return (
    <div className={className}>
      {urls.map((url, indice) => (
        <a
          key={url}
          href={url}
          target="_blank"
          rel="noreferrer"
          title="Ver evidencia en tamaño completo"
        >
          <img src={url} alt={`Evidencia ${indice + 1} del ${lado}`} />
        </a>
      ))}
      {urls.length < cantidad && (
        <span className={`${className}-cargando`}>Cargando evidencias…</span>
      )}
    </div>
  );
}

export default EvidenciasDeDisputa;
