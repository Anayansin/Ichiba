import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { capturarOrdenPago } from "../../services/pagoService";
import "./PagoExitoso.css";

function PagoExitoso() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [estado, setEstado] = useState<"procesando" | "exito" | "error">(
    "procesando",
  );
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    const orderId = searchParams.get("token");
    if (!orderId) {
      setEstado("error");
      setMensaje("No se encontró la información del pago");
      return;
    }

    capturarOrdenPago(orderId)
      .then(() => {
        setEstado("exito");
        setTimeout(() => navigate("/chats"), 2500);
      })
      .catch((err) => {
        setEstado("error");
        setMensaje(err.response?.data?.message || "Error al confirmar el pago");
      });
  }, [searchParams, navigate]);

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
    </div>
  );
}

export default PagoExitoso;
