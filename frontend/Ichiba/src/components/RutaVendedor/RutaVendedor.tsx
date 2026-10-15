import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import ModalConfirmacionHorario from "../ModalConfirmacionHorario/ModalConfirmacionHorario";

/**
 * Ruta contenedora de todas las vistas del panel del vendedor (RQNF5.3):
 * mientras no confirme el horario del mes, el modal bloqueante tapa la
 * pantalla y no deja usar ninguna función del panel.
 *
 * El administrador no tiene panel de vendedor: no publica, no vende y no
 * confirma horarios, así que se le redirige a su panel de supervisión.
 */
function RutaVendedor() {
  const { usuario } = useAuth();

  if (usuario?.tipo === "admin") {
    return <Navigate to="/admin" replace />;
  }

  return (
    <>
      <ModalConfirmacionHorario />
      <Outlet />
    </>
  );
}

export default RutaVendedor;
