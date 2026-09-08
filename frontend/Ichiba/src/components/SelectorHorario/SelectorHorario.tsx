import "./SelectorHorario.css";

export type BloqueHorario = {
  dia: string;
  activo: boolean;
  horaInicio: string;
  horaFin: string;
};

const DIAS = [
  { valor: "lunes", label: "Lunes" },
  { valor: "martes", label: "Martes" },
  { valor: "miercoles", label: "Miércoles" },
  { valor: "jueves", label: "Jueves" },
  { valor: "viernes", label: "Viernes" },
  { valor: "sabado", label: "Sábado" },
  { valor: "domingo", label: "Domingo" },
];

interface SelectorHorarioProps {
  horarios: BloqueHorario[];
  onChange: (horarios: BloqueHorario[]) => void;
}

function SelectorHorario({ horarios, onChange }: SelectorHorarioProps) {
  function actualizarDia(dia: string, cambios: Partial<BloqueHorario>) {
    const nuevos = horarios.map((h) =>
      h.dia === dia ? { ...h, ...cambios } : h,
    );
    onChange(nuevos);
  }

  return (
    <div className="selector-horario">
      {DIAS.map(({ valor, label }) => {
        const bloque = horarios.find((h) => h.dia === valor) || {
          dia: valor,
          activo: false,
          horaInicio: "09:00",
          horaFin: "18:00",
        };

        return (
          <div key={valor} className="selector-horario__fila">
            <label className="selector-horario__dia">
              <input
                type="checkbox"
                checked={bloque.activo}
                onChange={(e) =>
                  actualizarDia(valor, { activo: e.target.checked })
                }
              />
              {label}
            </label>

            {bloque.activo && (
              <div className="selector-horario__horas">
                <input
                  type="time"
                  min="05:00"
                  max="23:59"
                  value={bloque.horaInicio}
                  onChange={(e) =>
                    actualizarDia(valor, { horaInicio: e.target.value })
                  }
                />
                <span>a</span>
                <input
                  type="time"
                  min="05:00"
                  max="23:59"
                  value={bloque.horaFin}
                  onChange={(e) =>
                    actualizarDia(valor, { horaFin: e.target.value })
                  }
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default SelectorHorario;
