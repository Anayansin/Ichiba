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

const NOMBRES_DE_DIA = [
  "domingo",
  "lunes",
  "martes",
  "miercoles",
  "jueves",
  "viernes",
  "sabado",
];

function minutosDesdeMedianoche(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}

function minutosDesdeMedianocheDeFecha(fecha: Date): number {
  return fecha.getHours() * 60 + fecha.getMinutes();
}

function formatoHoraValido(hora: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(hora);
}

function bloqueUtilizable(bloque: BloqueHorario): boolean {
  return (
    bloque.activo &&
    formatoHoraValido(bloque.horaInicio) &&
    formatoHoraValido(bloque.horaFin)
  );
}

function etiquetaDeDia(diasAdelante: number, nombreDelDia: string): string {
  if (diasAdelante === 0) return "hoy";
  if (diasAdelante === 1) return "mañana";
  return `el próximo ${nombreDelDia}`;
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

export function estaDentroDeSuHorario(
  horarios: BloqueHorario[],
  fechaActual: Date,
): boolean {
  if (!Array.isArray(horarios)) return false;

  const nombreDelDia = NOMBRES_DE_DIA[fechaActual.getDay()];
  const minutosAhora = minutosDesdeMedianocheDeFecha(fechaActual);

  const bloqueDeHoy = horarios.find(
    (bloque) => bloque.dia === nombreDelDia && bloqueUtilizable(bloque),
  );

  if (!bloqueDeHoy) return false;

  const inicio = minutosDesdeMedianoche(bloqueDeHoy.horaInicio);
  const fin = minutosDesdeMedianoche(bloqueDeHoy.horaFin);

  return minutosAhora >= inicio && minutosAhora < fin;
}

export function obtenerTextoDeProximoBloque(
  horarios: BloqueHorario[],
  fechaActual: Date,
): string | null {
  if (!Array.isArray(horarios)) return null;

  const minutosAhora = minutosDesdeMedianocheDeFecha(fechaActual);

  for (let diasAdelante = 0; diasAdelante <= 7; diasAdelante += 1) {
    const fechaBuscada = new Date(fechaActual);
    fechaBuscada.setDate(fechaActual.getDate() + diasAdelante);
    const nombreDelDia = NOMBRES_DE_DIA[fechaBuscada.getDay()];

    const bloque = horarios.find(
      (item) => item.dia === nombreDelDia && bloqueUtilizable(item),
    );

    if (!bloque) continue;

    const bloqueDeHoyYaTermino =
      diasAdelante === 0 &&
      minutosDesdeMedianoche(bloque.horaFin) <= minutosAhora;

    if (bloqueDeHoyYaTermino) continue;

    return `${etiquetaDeDia(diasAdelante, nombreDelDia)} de ${bloque.horaInicio} a ${bloque.horaFin}`;
  }

  return null;
}
