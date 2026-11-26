import { useState, ReactNode } from "react";
import { AuthContext } from "./AuthContext";
import type { Usuario } from "../services/authService";
import {
  borrarSesion,
  guardarSesion,
  tokenDeSesion,
  usuarioDeSesion,
} from "../utils/sesion";

type SesionGuardada = {
  usuario: Usuario | null;
  token: string | null;
};

function leerSesionGuardada(): SesionGuardada {
  const token = tokenDeSesion();
  const usuario = usuarioDeSesion();
  return token && usuario ? { usuario, token } : { usuario: null, token: null };
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
    guardarSesion(usuarioNuevo, tokenNuevo);
  }

  function logout() {
    setUsuario(null);
    setToken(null);
    borrarSesion();
  }

  return (
    <AuthContext.Provider value={{ usuario, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
