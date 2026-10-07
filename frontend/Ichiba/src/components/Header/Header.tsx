import Boton from "../Boton/Boton";
import { useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  CATEGORIAS_PRODUCTO,
  TIPOS_PROMOCIONAL,
} from "../../configuracion/categorias";
import "./Header.css";

const categorias = CATEGORIAS_PRODUCTO;

interface HeaderProps {
  onOpenLogin: () => void;
}

function Header({ onOpenLogin }: HeaderProps) {
  const [categoriasAbiertas, setCategoriasAbiertas] = useState(false);
  const [promocionalesAbiertos, setPromocionalesAbiertos] = useState(false);
  const [menuUsuarioAbierto, setMenuUsuarioAbierto] = useState(false);
  const [busquedaAbierta, setBusquedaAbierta] = useState(false);
  const [textoBusqueda, setTextoBusqueda] = useState("");
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();

  // Al picar la lupa se esconde el resto de la barra (menos el logo y el
  // avatar) y el buscador se ocupa el espacio que dejaron los enlaces.
  function abrirBusqueda() {
    setBusquedaAbierta(true);
    setCategoriasAbiertas(false);
    setPromocionalesAbiertos(false);
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

  function manjarTeclasBusqueda(evento: KeyboardEvent<HTMLFormElement>) {
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
        to="/Inicio"
        className="header__logo"
        onClick={() => setBusquedaAbierta(false)}
      >
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
                  to={`/inicio?categoria=${categoria.toLowerCase()}`}
                  className="header__menu-item"
                >
                  {categoria}
                </Link>
              ))}

              <div
                className="header__submenu"
                onMouseEnter={() => setPromocionalesAbiertos(true)}
                onMouseLeave={() => setPromocionalesAbiertos(false)}
              >
                <Link to="/promocionales" className="header__menu-item">
                  Promocionales ▸
                </Link>

                {promocionalesAbiertos && (
                  <div className="header__submenu-despliega">
                    <span className="header__submenu-titulo">
                      Tipos de promocional
                    </span>
                    {TIPOS_PROMOCIONAL.map((tipo) => (
                      <Link
                        key={tipo.valor}
                        to={`/promocionales?tipo=${tipo.valor}`}
                        className="header__menu-item"
                      >
                        {tipo.texto}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <Link to="/" className="header__link">
          Nosotros
        </Link>
        <Link to="/Ayuda" className="header__link">
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
          onKeyDown={manjarTeclasBusqueda}
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
            🔍
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
              {usuario.tipo === "admin" && (
                <Link to="/admin/reportes" className="header__menu-item">
                  Reportes
                </Link>
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
        <Boton texto="Iniciar Sesion" onClick={onOpenLogin} />
      )}
    </header>
  );
}

export default Header;
