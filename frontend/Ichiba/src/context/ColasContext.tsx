import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { fetchMisFilas, type Fila } from "../services/colaService";

type ColasContextType = {
  filas: Fila[];
  cantidadFilas: number;
  recargarFilas: () => void;
};

const ColasContext = createContext<ColasContextType | undefined>(undefined);

export function ColasProvider({ children }: { children: ReactNode }) {
  const [filas, setFilas] = useState<Fila[]>([]);

  function recargarFilas() {
    fetchMisFilas()
      .then((data) => setFilas(data))
      .catch((error) => console.error("Error al cargar filas:", error));
  }

  useEffect(() => {
    recargarFilas();
  }, []);

  return (
    <ColasContext.Provider
      value={{ filas, cantidadFilas: filas.length, recargarFilas }}
    >
      {children}
    </ColasContext.Provider>
  );
}

export function useColas() {
  const context = useContext(ColasContext);
  if (!context) {
    throw new Error("useColas debe usarse dentro de un ColasProvider");
  }
  return context;
}
