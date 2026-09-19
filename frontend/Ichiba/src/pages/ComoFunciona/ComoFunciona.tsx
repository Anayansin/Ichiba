import "./ComoFunciona.css";

const PASOS = [
  {
    numero: "01",
    titulo: "Explora el catálogo",
    texto:
      "Navega por categorías o busca un producto específico, sin necesidad de crear una cuenta.",
  },
  {
    numero: "02",
    titulo: "Entra a la fila",
    texto:
      "Al entrar a la fila de un producto, se te asigna una posición ordenada según el momento en que llegaste.",
  },
  {
    numero: "03",
    titulo: "Espera tu turno",
    texto:
      "Solo quien ocupa la posición uno puede pagar. Puedes seguir tu avance desde la burbuja flotante.",
  },
  {
    numero: "04",
    titulo: "Paga con PayPal",
    texto:
      "El pago se procesa de forma segura y va directo a la cuenta de PayPal del vendedor.",
  },
  {
    numero: "05",
    titulo: "Coordina la entrega",
    texto:
      "Al confirmarse el pago, se habilita un chat privado entre tú y el vendedor para acordar la entrega.",
  },
];

function ComoFunciona() {
  return (
    <div className="como-funciona">
      <h1>Cómo funciona Ichiba</h1>
      <div className="como-funciona__lista">
        {PASOS.map((paso) => (
          <div key={paso.numero} className="como-funciona__paso">
            <span className="como-funciona__numero">{paso.numero}</span>
            <div>
              <h3>{paso.titulo}</h3>
              <p>{paso.texto}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ComoFunciona;
