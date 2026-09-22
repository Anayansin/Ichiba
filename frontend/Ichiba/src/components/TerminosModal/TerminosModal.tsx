import { useState } from "react";
import "./TerminosModal.css";

const categoriasCorreo = [
  { valor: "ropa", texto: "Ropa" },
  { valor: "hogar", texto: "Hogar" },
  { valor: "electrodomesticos", texto: "Electrodomésticos" },
  { valor: "coleccionables", texto: "Coleccionables" },
  { valor: "artesanias", texto: "Artesanías" },
  { valor: "otros", texto: "Otros" },
];

const FORMATO_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface PreferenciasNotificacion {
  correo: string;
  categorias: string[];
}

interface TerminosModalProps {
  onAceptar: (preferencias: PreferenciasNotificacion) => void;
  onCerrar: () => void;
}

function TerminosModal({ onAceptar, onCerrar }: TerminosModalProps) {
  const [aceptaTerminos, setAceptaTerminos] = useState(false);
  const [correo, setCorreo] = useState(
    localStorage.getItem("correoNotificaciones") || "",
  );
  const [categorias, setCategorias] = useState<string[]>([]);
  const [error, setError] = useState("");

  function alternarCategoria(valor: string) {
    setError("");
    setCategorias((prev) =>
      prev.includes(valor)
        ? prev.filter((categoria) => categoria !== valor)
        : [...prev, valor],
    );
  }

  function handleContinuar() {
    if (!aceptaTerminos) return;

    const correoLimpio = correo.trim();

    if (correoLimpio && !FORMATO_CORREO.test(correoLimpio)) {
      setError("Escribe un correo válido");
      return;
    }

    if (correoLimpio && categorias.length === 0) {
      setError("Selecciona al menos una categoría");
      return;
    }

    if (!correoLimpio && categorias.length > 0) {
      setError("Escribe tu correo para recibir notificaciones");
      return;
    }

    setError("");
    onAceptar({ correo: correoLimpio, categorias });
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
            onChange={(e) => {
              setAceptaTerminos(e.target.checked);
              setError("");
            }}
          />
          Acepto los terminos y condiciones de Ichiba
        </label>

        <div className="terminos-modal__notificaciones">
          <p className="terminos-modal__subtitulo">
            Notificaciones de ofertas (opcional)
          </p>
          <p className="terminos-modal__ayuda">
            Déjanos tu correo y marca una o más categorías para avisarte cuando
            haya ofertas:
          </p>

          <input
            type="email"
            className="terminos-modal__correo"
            placeholder="Correo electrónico"
            value={correo}
            onChange={(e) => {
              setCorreo(e.target.value);
              setError("");
            }}
          />

          <div className="terminos-modal__categorias">
            {categoriasCorreo.map((categoria) => (
              <label
                key={categoria.valor}
                className="terminos-modal__categoria"
              >
                <input
                  type="checkbox"
                  checked={categorias.includes(categoria.valor)}
                  onChange={() => alternarCategoria(categoria.valor)}
                />
                {categoria.texto}
              </label>
            ))}
          </div>
        </div>

        {error && <p className="terminos-modal__error">{error}</p>}

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
