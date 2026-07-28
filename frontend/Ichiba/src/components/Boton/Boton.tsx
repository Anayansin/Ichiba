interface BotonProps {
  texto: string;
  onClick: () => void;
}

import "./Boton.css";

function Boton({ texto, onClick }: BotonProps) {
  return (
    <button className="btn" onClick={onClick}>
      {texto}
    </button>
  );
}

export default Boton;
