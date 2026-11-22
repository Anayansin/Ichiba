import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import ModalConfirmacionHorario from "../ModalConfirmacionHorario/ModalConfirmacionHorario";

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
