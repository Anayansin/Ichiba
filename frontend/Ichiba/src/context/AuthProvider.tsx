import { useState, ReactNode } from "react";
import { AuthContext } from "./AuthContext";
import type { Usuario } from "../services/authService";

type SesionGuardada = {
  usuario: Usuario | null;
  token: string | null;
};

function leerSesionGuardada(): SesionGuardada {
  try {
    const token = localStorage.getItem("token");
    const usuarioGuardado = localStorage.getItem("usuario");

    if (!token || !usuarioGuardado) {
      return { usuario: null, token: null };
    }

    return { usuario: JSON.parse(usuarioGuardado) as Usuario, token };
  } catch {
    return { usuario: null, token: null };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(
    () => leerSesionGuardada().usuario,
  );
  const [token, setToken] = useState<string | null>(
    () => leerSesionGuardada().token,
  );

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
