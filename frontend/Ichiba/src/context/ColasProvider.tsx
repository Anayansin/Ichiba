import { useState, useEffect, useCallback, ReactNode } from "react";
import { ColasContext } from "./ColasContext";
import { fetchMisFilas, type Fila } from "../services/colaService";

export function ColasProvider({ children }: { children: ReactNode }) {
  const [filas, setFilas] = useState<Fila[]>([]);

  const recargarFilas = useCallback(() => {
    fetchMisFilas()
      .then((data) => setFilas(data))
      .catch((error) => console.error("Error al cargar filas:", error));
  }, []);

  useEffect(() => {
    recargarFilas();
    const intervalo = setInterval(recargarFilas, 5000);
    return () => clearInterval(intervalo);
  }, [recargarFilas]);

  return (
    <ColasContext.Provider
      value={{ filas, cantidadFilas: filas.length, recargarFilas }}
    >
      {children}
    </ColasContext.Provider>
  );
}
