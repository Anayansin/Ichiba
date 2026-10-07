import { useEffect, useRef, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { capturarOrdenPago } from "../../services/pagoService";
import AdvertenciaEncuentroModal from "../../components/AdvertenciaEncuentroModal/AdvertenciaEncuentroModal";
import "./PagoExitoso.css";

const LLAVE_ADVERTENCIA_ENCUENTRO_VISTA = "advertenciaEncuentroVista";

function PagoExitoso() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [estado, setEstado] = useState<"procesando" | "exito" | "error">(
    "procesando",
  );
  const [mensaje, setMensaje] = useState("");
  const [mostrarAdvertencia, setMostrarAdvertencia] = useState(false);
  // En desarrollo React ejecuta el efecto dos veces; la captura solo debe
  // dispararse una vez por regreso de PayPal.
  const capturaIniciada = useRef(false);

  useEffect(() => {
    if (capturaIniciada.current) return;
    capturaIniciada.current = true;

    const orderId = searchParams.get("token");
    if (!orderId) {
      setEstado("error");
      setMensaje("No se encontró la información del pago");
      return;
    }

    capturarOrdenPago(orderId)
      .then(() => {
        setEstado("exito");

        const advertenciaYaVista =
          localStorage.getItem(LLAVE_ADVERTENCIA_ENCUENTRO_VISTA) === "true";

        if (advertenciaYaVista) {
          setTimeout(() => navigate("/chats"), 2500);
        } else {
          setMostrarAdvertencia(true);
        }
      })
      .catch((err) => {
        setEstado("error");
        setMensaje(err.response?.data?.message || "Error al confirmar el pago");
      });
  }, [searchParams, navigate]);

  function handleEntendido() {
    localStorage.setItem(LLAVE_ADVERTENCIA_ENCUENTRO_VISTA, "true");
    setMostrarAdvertencia(false);
    navigate("/chats");
  }

  return (
    <div className="pago-exitoso">
      {estado === "procesando" && <p>Confirmando tu pago...</p>}
      {estado === "exito" && (
        <>
          <h2>¡Pago completado! 🎉</h2>
          <p>
            Te vamos a redirigir al chat con el vendedor para coordinar la
            entrega.
          </p>
        </>
      )}
      {estado === "error" && (
        <>
          <h2>Hubo un problema</h2>
          <p>{mensaje}</p>
        </>
      )}

      {mostrarAdvertencia && (
        <AdvertenciaEncuentroModal onEntendido={handleEntendido} />
      )}
    </div>
  );
}

export default PagoExitoso;
