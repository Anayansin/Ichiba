import "./Boton.css";

interface PropiedadesDeBoton {
  texto: string;
  onClick: () => void;
  type?: "button" | "submit";
}

function Boton({ texto, onClick, type = "button" }: PropiedadesDeBoton) {
  return (
    <button type={type} className="boton" onClick={onClick}>
      {texto}
    </button>
  );
}

export default Boton;
