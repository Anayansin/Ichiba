import { Routes, Route } from "react-router-dom";
import Header from "./components/Header/Header";
import Nosotros from "./pages/Nosotros/Nosotros";
import Chats from "./pages/Chats/Chats";
import Inicio from "./pages/Inicio/Inicio";
import Ayuda from "./pages/Ayuda/Ayuda";
import IniciarSesion from "./components/auth/IniciarSesionModal/IniciarSesion";
import RegistarCuenta from "./pages/RegistrarCuenta/RegistrarCuenta";
import ProductoCompleto from "./pages/ProductoCompleto/ProductoCompleto";
import PanelVendedor from "./pages/PanelVendedor/PanelVendedor";
import RegistrarProducto from "./pages/RegistrarProducto/RegistrarProducto";
import RegistrarPromocional from "./pages/RegistrarPromocional/RegistrarPromocional";
import Promocionales from "./pages/Promocionales/Promocionales";
import PromocionalDetalle from "./pages/PromocionalDetalle/PromocionalDetalle";
import VendedorPerfil from "./pages/PerfilDelVendedor/PerfilDelVendedor";
import ColaBubble from "./components/ColaBubble/ColaBubble";
import ChatBotAyuda from "./components/ChatBotAyuda/ChatBotAyuda";
import { useState } from "react";
import { AuthProvider } from "./context/AuthProvider";
import { ColasProvider } from "./context/ColasProvider";
import EditarProducto from "./pages/EditarProducto/EditarProducto";
import PagoExitoso from "./pages/PagoExitoso/PagoExitoso";
import HorarioVendedor from "./pages/HorarioVendedor/HorarioVendedor";
import ReportarComprador from "./pages/ReportarComprador/ReportarComprador";
import Admin from "./pages/Admin/Admin";
import AdminReportes from "./pages/AdminReportes/AdminReportes";
import RecuperarPassword from "./pages/RecuperarPassword/RecuperarPassword";
import Estadisticas from "./pages/Estadisticas/Estadisticas";

function App() {
  const [inicioSesion, setInicioSesion] = useState(false);

  return (
    <AuthProvider>
      <ColasProvider>
        <Header onOpenLogin={() => setInicioSesion(true)} />

        <Routes>
          <Route path="/inicio" element={<Inicio />} />
          <Route path="/chats" element={<Chats />} />
          <Route
            path="/"
            element={<Nosotros onOpenLogin={() => setInicioSesion(true)} />}
          />
          <Route path="/ayuda" element={<Ayuda />} />
          <Route path="/registro" element={<RegistarCuenta />} />
          <Route path="/producto/:id" element={<ProductoCompleto />} />
          <Route path="/promocionales" element={<Promocionales />} />
          <Route path="/promocional/:id" element={<PromocionalDetalle />} />
          <Route path="/panel-vendedor" element={<PanelVendedor />} />
          <Route
            path="/panel-vendedor/editar/:id"
            element={<EditarProducto />}
          />
          <Route
            path="/panel-vendedor/publicar"
            element={<RegistrarProducto />}
          />
          <Route
            path="/panel-vendedor/promocionar"
            element={<RegistrarPromocional />}
          />
          <Route path="/panel-vendedor/horario" element={<HorarioVendedor />} />
          <Route
            path="/panel-vendedor/reportar-comprador"
            element={<ReportarComprador />}
          />
          <Route
            path="/panel-vendedor/estadisticas"
            element={<Estadisticas />}
          />
          <Route path="/admin" element={<Admin />} />
          <Route path="/admin/reportes" element={<AdminReportes />} />
          <Route path="/recuperar-password" element={<RecuperarPassword />} />
          <Route path="/vendedor/:id" element={<VendedorPerfil />} />
          <Route path="/pago-exitoso" element={<PagoExitoso />} />
        </Routes>

        {inicioSesion && (
          <IniciarSesion onClose={() => setInicioSesion(false)} />
        )}
        <ColaBubble />
        <ChatBotAyuda />
      </ColasProvider>
    </AuthProvider>
  );
}

export default App;
