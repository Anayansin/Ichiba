import { Routes, Route } from "react-router-dom";
import Header from "./components/Header/Header";
import Nosotros from "./pages/Nosotros/Nosotros";
import Chats from "./pages/Chats/Chats";
import Inicio from "./pages/Inicio/Inicio";
import Ayuda from "./pages/Ayuda/Ayuda";
import IniciarSesion from "./components/auth/IniciarSesionModal/IniciarSesion";
import RegistarCuenta from "./pages/RegistrarCuenta/RegistrarCuenta";
import { useState } from "react";

function App() {
  const [inicioSesion, setInicioSesion] = useState(false);

  return (
    <div>
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
      </Routes>

      {inicioSesion && <IniciarSesion onClose={() => setInicioSesion(false)} />}
    </div>
  );
}

export default App;
