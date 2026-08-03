import Boton from "../Boton/Boton";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import "./Header.css";

const categorias = [
  "Artesanias",
  "Ropa",
  "Hogar",
  "Electrodomesticos",
  "Coleccionables",
  "Otros",
];

interface HeaderProps {
  onOpenLogin: () => void;
}

function Header({ onOpenLogin }: HeaderProps) {
  const [categoriasAbiertas, setCategoriasAbiertas] = useState(false);
  const [menuUsuarioAbierto, setMenuUsuarioAbierto] = useState(false);
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    setMenuUsuarioAbierto(false);
    navigate("/");
  }

  const inicialNombre = usuario?.nombreCompleto.charAt(0).toUpperCase();

  return (
    <header className="header">
      <Link to="/Inicio" className="header__logo">
        ICHIBA
      </Link>

      <nav className="header__nav">
        <Link to="/Inicio" className="header__link">
          Inicio
        </Link>
        <Link to="/Chats" className="header__link">
          Chats
        </Link>

        <div
          className="header__menu"
          onClick={() => setCategoriasAbiertas(!categoriasAbiertas)}
        >
          <p className="header__link header__nav"> Categorias ▾</p>

          {categoriasAbiertas && (
            <div className="header__menu-despliega">
              {categorias.map((categoria) => (
                <Link
                  key={categoria}
                  to={`/?categoria=${categoria.toLowerCase()}`}
                  className="header__menu-item"
                >
                  {categoria}
                </Link>
              ))}
            </div>
          )}
        </div>

        <Link to="/" className="header__link">
          Nosotros
        </Link>
        <Link to="/Ayuda" className="header__link">
          Ayuda
        </Link>
      </nav>

      {usuario ? (
        <div
          className="header__usuario"
          onClick={() => setMenuUsuarioAbierto(!menuUsuarioAbierto)}
        >
          <div className="header__avatar">{inicialNombre}</div>

          {menuUsuarioAbierto && (
            <div className="header__usuario-despliega">
              <p className="header__usuario-nombre">{usuario.nombreCompleto}</p>
              <p className="header__usuario-correo">{usuario.correo}</p>
              <hr />
              <Link to="/panel-vendedor" className="header__menu-item">
                Mi panel
              </Link>
              <Link to="/panel-vendedor/publicar" className="header__menu-item">
                Publicar producto
              </Link>
              <Link
                to="/panel-vendedor/estadisticas"
                className="header__menu-item"
              >
                Estadísticas
              </Link>
              <button
                className="header__menu-item header__logout"
                onClick={handleLogout}
              >
                Cerrar sesión
              </button>
            </div>
          )}
        </div>
      ) : (
        <Boton texto="Iniciar Sesion" onClick={onOpenLogin} />
      )}
    </header>
  );
}

export default Header;
