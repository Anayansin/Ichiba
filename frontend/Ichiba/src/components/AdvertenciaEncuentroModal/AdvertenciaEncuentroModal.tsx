import "./AdvertenciaEncuentroModal.css";

const RECOMENDACIONES_ENCUENTRO = [
  "Evita lugares poco seguros, aislados o con poca iluminación.",
  "Avísale a alguien de confianza a dónde vas y con quién te vas a encontrar.",
  "Prefiere sitios públicos y con gente, como cafeterías o centros comerciales.",
];

interface AdvertenciaEncuentroModalProps {
  onEntendido: () => void;
}

function AdvertenciaEncuentroModal({
  onEntendido,
}: AdvertenciaEncuentroModalProps) {
  return (
    <div className="advertencia-encuentro-modal-overlay">
      <div
        className="advertencia-encuentro-modal"
        role="dialog"
        aria-modal="true"
      >
        <h2>Antes de encontrarte en persona</h2>
        <p className="advertencia-encuentro-modal__intro">
          Si vas a coordinar una entrega en persona, ten en cuenta lo siguiente
          para tu seguridad:
        </p>

        <div className="advertencia-encuentro-modal__texto">
          <ul>
            {RECOMENDACIONES_ENCUENTRO.map((recomendacion) => (
              <li key={recomendacion}>{recomendacion}</li>
            ))}
          </ul>
        </div>

        <button
          className="advertencia-encuentro-modal__boton"
          onClick={onEntendido}
        >
          Entendido
        </button>
      </div>
    </div>
  );
}

export default AdvertenciaEncuentroModal;
