import { Outlet } from "react-router-dom";
import ModalConfirmacionHorario from "../ModalConfirmacionHorario/ModalConfirmacionHorario";

/**
 * Ruta contenedora de todas las vistas del panel del vendedor (RQNF5.3):
 * mientras no confirme el horario del mes, el modal bloqueante tapa la
 * pantalla y no deja usar ninguna función del panel.
 */
function RutaVendedor() {
  return (
    <>
      <ModalConfirmacionHorario />
      <Outlet />
    </>
  );
}

export default RutaVendedor;
