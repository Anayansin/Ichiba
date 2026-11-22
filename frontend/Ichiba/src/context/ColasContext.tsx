import { createContext, useContext } from "react";
import type { AvisoFila, Fila } from "../services/colaService";

type ColasContextType = {
  filas: Fila[];
  cantidadFilas: number;
  recargarFilas: () => void;
  avisos: AvisoFila[];
  descartarAviso: (id: string) => void;
};

export const ColasContext = createContext<ColasContextType | undefined>(
  undefined,
);

export function useColas() {
  const context = useContext(ColasContext);
  if (!context) {
    throw new Error("useColas debe usarse dentro de un ColasProvider");
  }
  return context;
}
