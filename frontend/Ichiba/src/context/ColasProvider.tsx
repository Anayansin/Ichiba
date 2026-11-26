import { useState, useEffect, useCallback, ReactNode } from "react";
import { ColasContext } from "./ColasContext";
import { useAuth } from "./AuthContext";
import {
  fetchAvisosFilas,
  fetchMisFilas,
  type AvisoFila,
  type Fila,
} from "../services/colaService";

const LLAVE_AVISOS_VISTOS = "avisosFilaVistos";

function avisosVistos(): string[] {
  try {
    const guardados = JSON.parse(localStorage.getItem(LLAVE_AVISOS_VISTOS) ?? "[]");
    return Array.isArray(guardados) ? guardados : [];
  } catch {
    return [];
  }
}

export function ColasProvider({ children }: { children: ReactNode }) {
  const { usuario } = useAuth();
  const [filas, setFilas] = useState<Fila[]>([]);
  const [avisos, setAvisos] = useState<AvisoFila[]>([]);

  const recargarFilas = useCallback(() => {
    fetchMisFilas()
      .then((data) => setFilas(data))
      .catch((error) => console.error("Error al cargar filas:", error));
    fetchAvisosFilas()
      .then((data) => {
        const vistos = avisosVistos();
        setAvisos(data.filter((aviso) => !vistos.includes(aviso._id)));
      })
      .catch(() => {});
  }, []);

  const descartarAviso = useCallback((id: string) => {
    const vistos = avisosVistos();
    localStorage.setItem(
      LLAVE_AVISOS_VISTOS,
      JSON.stringify([...vistos, id].slice(-200)),
    );
    setAvisos((actuales) => actuales.filter((aviso) => aviso._id !== id));
  }, []);

  useEffect(() => {
    setFilas([]);
    setAvisos([]);
    recargarFilas();
    const intervalo = setInterval(recargarFilas, 5000);
    return () => clearInterval(intervalo);
  }, [recargarFilas, usuario?.id]);

  return (
    <ColasContext.Provider
      value={{
        filas,
        cantidadFilas: filas.length,
        recargarFilas,
        avisos,
        descartarAviso,
      }}
    >
      {children}
    </ColasContext.Provider>
  );
}
