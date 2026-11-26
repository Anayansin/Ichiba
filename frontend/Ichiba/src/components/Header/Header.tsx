import Boton from "../Boton/Boton";
import { useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  CATEGORIAS_PRODUCTO,
  textoCategoria,
} from "../../configuracion/categorias";
import "./Header.css";

const categorias = CATEGORIAS_PRODUCTO;

interface HeaderProps {
  onOpenLogin: () => void;
}

function Header({ onOpenLogin }: HeaderProps) {
  const [categoriasAbiertas, setCategoriasAbiertas] = useState(false);
  const [menuUsuarioAbierto, setMenuUsuarioAbierto] = useState(false);
  const [busquedaAbierta, setBusquedaAbierta] = useState(false);
  const [textoBusqueda, setTextoBusqueda] = useState("");
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();

  function abrirBusqueda() {
    setBusquedaAbierta(true);
    setCategoriasAbiertas(false);
    setMenuUsuarioAbierto(false);
  }

  function cerrarBusqueda() {
    setBusquedaAbierta(false);
  }

  function enviarBusqueda(evento: FormEvent) {
    evento.preventDefault();
    const termino = textoBusqueda.trim();
    navigate(termino ? `/inicio?q=${encodeURIComponent(termino)}` : "/inicio");
    setBusquedaAbierta(false);
  }

  function manejarTeclasBusqueda(evento: KeyboardEvent<HTMLFormElement>) {
    if (evento.key === "Escape") {
      cerrarBusqueda();
    }
  }

  function handleLogout() {
    logout();
    setMenuUsuarioAbierto(false);
    navigate("/");
  }

  const inicialNombre = usuario?.nombreCompleto.charAt(0).toUpperCase();

  return (
    <header
      className={`header${busquedaAbierta ? " header--buscando" : ""}`}
    >
      <Link
        to="/inicio"
        className="header__logo"
        onClick={() => setBusquedaAbierta(false)}
      >
        ICHIBA
      </Link>

      <nav className="header__nav">
        <Link to="/inicio" className="header__link">
          Inicio
        </Link>
        <Link to="/chats" className="header__link">
          Chats
        </Link>

        <div
          className="header__menu"
          onClick={() => setCategoriasAbiertas(!categoriasAbiertas)}
        >
          <p className="header__link header__nav">Categorías ▾</p>

          {categoriasAbiertas && (
            <div className="header__menu-despliega">
              {categorias.map((categoria) => (
                <Link
                  key={categoria}
                  to={`/inicio?categoria=${categoria.toLowerCase()}`}
                  className="header__menu-item"
                >
                  {textoCategoria(categoria)}
                </Link>
              ))}

            </div>
          )}
        </div>

        <Link to="/promocionales" className="header__link">
          Promocionales
        </Link>

        <Link to="/" className="header__link">
          Nosotros
        </Link>
        <Link to="/ayuda" className="header__link">
          Ayuda
        </Link>

        <button
          type="button"
          className="header__link header__lupa"
          onClick={abrirBusqueda}
          aria-label="Buscar"
          title="Buscar"
        >
          <svg
            className="header__lupa-icono"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle cx="10.5" cy="10.5" r="6.5" />
            <line x1="15.5" y1="15.5" x2="21" y2="21" />
          </svg>
        </button>
      </nav>

      {busquedaAbierta && (
        <form
          className="header__buscador header__buscador--expandido"
          onSubmit={enviarBusqueda}
          onKeyDown={manejarTeclasBusqueda}
          role="search"
        >
          <input
            type="search"
            className="header__buscador-input"
            placeholder="Buscar en ICHIBA..."
            value={textoBusqueda}
            onChange={(evento) => setTextoBusqueda(evento.target.value)}
            aria-label="Buscar productos"
            autoFocus
          />
          <button
            type="submit"
            className="header__buscador-boton"
            aria-label="Buscar"
          >
            <svg
              className="header__lupa-icono"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle cx="10.5" cy="10.5" r="6.5" />
              <line x1="15.5" y1="15.5" x2="21" y2="21" />
            </svg>
          </button>
          <button
            type="button"
            className="header__buscador-cerrar"
            onClick={cerrarBusqueda}
            aria-label="Cerrar búsqueda"
          >
            ✕
          </button>
        </form>
      )}

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
              <Link to="/mi-perfil" className="header__menu-item">
                Mi perfil
              </Link>
              {usuario.tipo !== "admin" ? (
                <>
                  <Link to="/panel-vendedor" className="header__menu-item">
                    Mi panel
                  </Link>
                  <Link
                    to="/panel-vendedor/publicar"
                    className="header__menu-item"
                  >
                    Publicar producto
                  </Link>
                  <Link
                    to="/panel-vendedor/estadisticas"
                    className="header__menu-item"
                  >
                    Estadísticas
                  </Link>
                </>
              ) : (
                <>
                  <Link to="/admin" className="header__menu-item">
                    Administración
                  </Link>
                  <Link to="/admin/reportes" className="header__menu-item">
                    Reportes
                  </Link>
                </>
              )}
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
        <Boton texto="Iniciar sesión" onClick={onOpenLogin} />
      )}
    </header>
  );
}

export default Header;
