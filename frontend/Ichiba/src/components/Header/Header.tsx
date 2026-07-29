import Boton from "../Boton/Boton";
import { useState } from "react";
import { Link } from "react-router-dom";
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

      <Boton texto="Iniciar Sesion" onClick={onOpenLogin}></Boton>
    </header>
  );
}

export default Header;
