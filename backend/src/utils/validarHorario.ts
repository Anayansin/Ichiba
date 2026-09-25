export type BloqueHorario = {
  dia:
    | "lunes"
    | "martes"
    | "miercoles"
    | "jueves"
    | "viernes"
    | "sabado"
    | "domingo";
  activo: boolean;
  horaInicio: string;
  horaFin: string;
};

const DIAS_VALIDOS = [
  "lunes",
  "martes",
  "miercoles",
  "jueves",
  "viernes",
  "sabado",
  "domingo",
];

function minutosDesdeMedianoche(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}

function formatoHoraValido(hora: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(hora);
}

/**
 * Valida la ventana diaria de coordinación de entrega de un producto.
 * Aplica las mismas reglas que el horario de trabajo: formato HH:MM y
 * límites de 05:00 a 23:59, con la hora de fin después de la de inicio.
 */
export function validarHorarioEntrega(
  horaInicio: unknown,
  horaFin: unknown,
): string | null {
  if (
    typeof horaInicio !== "string" ||
    typeof horaFin !== "string" ||
    !formatoHoraValido(horaInicio) ||
    !formatoHoraValido(horaFin)
  ) {
    return "Formato de hora inválido en el horario de entrega (usa HH:MM, 24 horas)";
  }

  const inicio = minutosDesdeMedianoche(horaInicio);
  const fin = minutosDesdeMedianoche(horaFin);
  const minimoPermitido = minutosDesdeMedianoche("05:00");
  const maximoPermitido = minutosDesdeMedianoche("23:59");

  if (inicio < minimoPermitido || fin > maximoPermitido) {
    return "El horario de coordinación de entrega debe estar entre las 05:00 y las 23:59";
  }

  if (fin <= inicio) {
    return "La hora de fin del horario de entrega debe ser después de la hora de inicio";
  }

  return null;
}

export function validarHorarioSemanal(
  horarios: BloqueHorario[],
): string | null {
  if (!Array.isArray(horarios) || horarios.length !== 7) {
    return "Debes definir un horario para los 7 días de la semana";
  }

  const diasVistos = new Set<string>();
  let minutosTotales = 0;

  for (const bloque of horarios) {
    if (!DIAS_VALIDOS.includes(bloque.dia)) {
      return `Día inválido: ${bloque.dia}`;
    }
    diasVistos.add(bloque.dia);

    if (!bloque.activo) continue;

    if (
      !formatoHoraValido(bloque.horaInicio) ||
      !formatoHoraValido(bloque.horaFin)
    ) {
      return `Formato de hora inválido en ${bloque.dia} (usa HH:MM, 24 horas)`;
    }

    const inicio = minutosDesdeMedianoche(bloque.horaInicio);
    const fin = minutosDesdeMedianoche(bloque.horaFin);
    const minimoPermitido = minutosDesdeMedianoche("05:00");
    const maximoPermitido = minutosDesdeMedianoche("23:59");

    if (inicio < minimoPermitido || fin > maximoPermitido) {
      return `El horario de ${bloque.dia} debe estar entre las 05:00 y las 23:59`;
    }

    if (fin <= inicio) {
      return `La hora de fin debe ser después de la hora de inicio en ${bloque.dia}`;
    }

    minutosTotales += fin - inicio;
  }

  if (diasVistos.size !== 7) {
    return "Debes definir un horario para los 7 días de la semana";
  }

  if (minutosTotales < 60) {
    return "Debes tener al menos 1 hora de disponibilidad a la semana";
  }

  return null;
}
