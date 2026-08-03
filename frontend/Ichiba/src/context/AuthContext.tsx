import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import type { Usuario } from "../services/authService";

type AuthContextType = {
  usuario: Usuario | null;
  token: string | null;
  login: (usuario: Usuario, token: string) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const tokenGuardado = localStorage.getItem("token");
    const usuarioGuardado = localStorage.getItem("usuario");

    if (tokenGuardado && usuarioGuardado) {
      setToken(tokenGuardado);
      setUsuario(JSON.parse(usuarioGuardado));
    }
  }, []);

  function login(usuarioNuevo: Usuario, tokenNuevo: string) {
    setUsuario(usuarioNuevo);
    setToken(tokenNuevo);
    localStorage.setItem("token", tokenNuevo);
    localStorage.setItem("usuario", JSON.stringify(usuarioNuevo));
  }

  function logout() {
    setUsuario(null);
    setToken(null);
    localStorage.removeItem("token");
    localStorage.removeItem("usuario");
  }

  return (
    <AuthContext.Provider value={{ usuario, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth debe usarse dentro de un AuthProvider");
  }
  return context;
}
