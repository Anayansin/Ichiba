interface BotonProps {
  texto: string;
  onClick: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
}

import "./Boton.css";

function Boton({ texto, onClick, type = "button", disabled }: BotonProps) {
  return (
    <button type={type} className="btn" onClick={onClick} disabled={disabled}>
      {texto}
    </button>
  );
}

export default Boton;
