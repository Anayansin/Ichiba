interface BotonProps {
  texto: string;
  onClick: () => void;
  type?: "button" | "submit";
}

import "./Boton.css";

function Boton({ texto, onClick, type = "button" }: BotonProps) {
  return (
    <button type={type} className="btn" onClick={onClick}>
      {texto}
    </button>
  );
}

export default Boton;
