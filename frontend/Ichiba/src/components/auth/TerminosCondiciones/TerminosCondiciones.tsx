import { Link } from "react-router-dom";
import Boton from "../../Boton/Boton";
import "./TerminosCondiciones.css";

interface TerminosCondicionesProps {
  onClose: () => void;
}

function TerminosCondiciones({ onClose }: TerminosCondicionesProps) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>
          ✕
        </button>
      </div>
    </div>
  );
}

export default TerminosCondiciones;
