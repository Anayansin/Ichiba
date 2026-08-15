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
import VendedorPerfil from "./pages/PerfilDelVendedor/PerfilDelVendedor";
import ColaBubble from "./components/ColaBubble/ColaBubble";
import { useState } from "react";
import { AuthProvider } from "./context/AuthContext";
import { ColasProvider } from "./context/ColasContext";
import EditarProducto from "./pages/EditarProducto/EditarProducto";

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
          <Route path="/panel-vendedor" element={<PanelVendedor />} />
          <Route
            path="/panel-vendedor/editar/:id"
            element={<EditarProducto />}
          />
          <Route
            path="/panel-vendedor/publicar"
            element={<RegistrarProducto />}
          />
          <Route path="/vendedor/:id" element={<VendedorPerfil />} />
        </Routes>

        {inicioSesion && (
          <IniciarSesion onClose={() => setInicioSesion(false)} />
        )}
        <ColaBubble />
      </ColasProvider>
    </AuthProvider>
  );
}

export default App;
