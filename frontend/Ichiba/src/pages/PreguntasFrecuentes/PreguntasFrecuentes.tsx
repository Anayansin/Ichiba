import { useState } from "react";
import "./PreguntasFrecuentes.css";

const PREGUNTAS = [
  {
    pregunta: "¿Necesito una cuenta para comprar?",
    respuesta:
      "No. Puedes explorar el catálogo y entrar a la fila virtual de cualquier producto sin registrarte. Solo los vendedores necesitan crear una cuenta y verificar su identidad.",
  },
  {
    pregunta: "¿Cómo funciona la fila virtual?",
    respuesta:
      "Cuando entras a la fila de un producto, se te asigna una posición. Solo la persona en la posición 1 puede pagar. Si esa persona sale de la fila o completa el pago, todos los demás avanzan un lugar automáticamente.",
  },
  {
    pregunta: "¿En cuántas filas puedo estar al mismo tiempo?",
    respuesta: "Puedes estar activo en un máximo de 3 filas simultáneas.",
  },
  {
    pregunta: "¿Cuándo puedo hablar con el vendedor?",
    respuesta:
      "El chat se habilita únicamente después de completar el pago de un producto, para coordinar la entrega. No existe comunicación con el vendedor antes de ese momento.",
  },
  {
    pregunta: "¿Cómo se verifica a los vendedores?",
    respuesta:
      "Cada vendedor debe registrar su identificación oficial, confirmar su correo electrónico y su cuenta de PayPal antes de poder publicar productos.",
  },
  {
    pregunta: "¿Qué pasa si un vendedor no confirma su horario mensual?",
    respuesta:
      "Los vendedores deben confirmar su disponibilidad cada mes. Si no lo hacen, reciben advertencias por correo y, tras un periodo prolongado sin confirmar, su cuenta puede ser eliminada.",
  },
];

function PreguntasFrecuentes() {
  const [abierta, setAbierta] = useState<number | null>(0);

  return (
    <div className="faq">
      <h1>Preguntas frecuentes</h1>

      {PREGUNTAS.map((item, index) => (
        <div key={index} className="faq__item">
          <button
            className="faq__pregunta"
            onClick={() => setAbierta(abierta === index ? null : index)}
          >
            {item.pregunta}
            <span>{abierta === index ? "−" : "+"}</span>
          </button>
          {abierta === index && (
            <p className="faq__respuesta">{item.respuesta}</p>
          )}
        </div>
      ))}
    </div>
  );
}

export default PreguntasFrecuentes;
