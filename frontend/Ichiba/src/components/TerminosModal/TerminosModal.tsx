import { useState } from "react";
import "./TerminosModal.css";

const categoriasCorreo = [
  "Ropa",
  "Hogar",
  "Electrodomesticos",
  "Coleccionables",
  "Artesanias",
  "Otros",
];

interface TerminosModalProps {
  onAceptar: (recibirCorreos: boolean, categoria: string) => void;
  onCerrar: () => void;
}

function TerminosModal({ onAceptar, onCerrar }: TerminosModalProps) {
  const [aceptaTerminos, setAceptaTerminos] = useState(false);
  const [recibirCorreos, setRecibirCorreos] = useState(false);
  const [categoria, setCategoria] = useState(categoriasCorreo[0]);

  function handleContinuar() {
    if (!aceptaTerminos) return;
    onAceptar(recibirCorreos, categoria);
  }

  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="terminos-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Antes de continuar</h2>
        <p className="terminos-modal__intro">
          Antes de entrar a tu primera fila virtual, necesitamos que confirmes
          lo siguiente:
        </p>

        <div className="terminos-modal__texto">
          <p>
            Al entrar en una fila virtual, aceptas participar en el proceso de
            compra de forma ordenada y respetando tu turno. Ichiba no se hace
            responsable por transacciones fuera de la plataforma. El
            incumplimiento reiterado puede resultar en reportes hacia tu cuenta.
          </p>
        </div>

        <label className="terminos-modal__checkbox">
          <input
            type="checkbox"
            checked={aceptaTerminos}
            onChange={(e) => setAceptaTerminos(e.target.checked)}
          />
          Acepto los terminos y condiciones de Ichiba
        </label>

        <label className="terminos-modal__checkbox">
          <input
            type="checkbox"
            checked={recibirCorreos}
            onChange={(e) => setRecibirCorreos(e.target.checked)}
          />
          Quiero recibir correos de ofertas de una categoría
        </label>

        {recibirCorreos && (
          <select
            className="terminos-modal__select"
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
          >
            {categoriasCorreo.map((cat) => (
              <option key={cat} value={cat.toLowerCase()}>
                {cat}
              </option>
            ))}
          </select>
        )}

        <button
          className="terminos-modal__boton"
          disabled={!aceptaTerminos}
          onClick={handleContinuar}
        >
          Aceptar y continuar
        </button>
      </div>
    </div>
  );
}

export default TerminosModal;
