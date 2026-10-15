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

/**
 * RQF5: el horario se define en hora de la zona centro (GMT-6). México ya no
 * aplica horario de verano (desde 2022), así que el desfijo es fijo y estas
 * funciones convierten cualquier instante al "reloj GMT-6" sin depender de
 * la zona del servidor (en local es GMT-6, en el hosting es UTC).
 */
const OFFSET_ZONA_CENTRO_MINUTOS = 6 * 60;

export function relojZonaCentro(fecha: Date): Date {
  return new Date(
    fecha.getTime() -
      OFFSET_ZONA_CENTRO_MINUTOS * 60000 +
      fecha.getTimezoneOffset() * 60000,
  );
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

  // El vendedor define su horario en GMT-6: comparar contra ese reloj.
  const reloj = relojZonaCentro(fechaActual);
  const nombreDelDia = NOMBRES_DE_DIA[reloj.getDay()];
  const minutosAhora = reloj.getHours() * 60 + reloj.getMinutes();

  const bloqueDeHoy = horarios.find(
    (bloque) => bloque.dia === nombreDelDia && bloqueUtilizable(bloque),
  );

  if (!bloqueDeHoy) return false;

  const inicio = minutosDesdeMedianoche(bloqueDeHoy.horaInicio);
  const fin = minutosDesdeMedianoche(bloqueDeHoy.horaFin);

  return minutosAhora >= inicio && minutosAhora < fin;
}

/** Convierte un "reloj GMT-6" (resultado de relojZonaCentro) a instante real. */
export function deRelojZonaCentro(reloj: Date): Date {
  return new Date(
    reloj.getTime() +
      OFFSET_ZONA_CENTRO_MINUTOS * 60000 -
      reloj.getTimezoneOffset() * 60000,
  );
}

/** RQNF24: texto "dd/mm/aaaa a las hh:mm" en hora del centro (GMT-6). */
export function formatearFechaHoraZonaCentro(fecha: Date): string {
  const reloj = relojZonaCentro(fecha);
  const dia = String(reloj.getDate()).padStart(2, "0");
  const mes = String(reloj.getMonth() + 1).padStart(2, "0");
  const anio = reloj.getFullYear();
  const hora = String(reloj.getHours()).padStart(2, "0");
  const minuto = String(reloj.getMinutes()).padStart(2, "0");
  return `${dia}/${mes}/${anio} a las ${hora}:${minuto}`;
}

/**
 * RQNF24 / RQNF31: los plazos del escrow se cuentan en bloques de atención
 * del vendedor. Para que un bloque cuente como oportunidad de atención debe
 * quedarle al menos este tiempo disponible desde el momento de referencia;
 * si el bloque vigente ya está por terminar, se usa el siguiente.
 */
const MINUTOS_MINIMOS_DE_ATENCION = 30;

export type BloqueProgramado = { inicio: Date; fin: Date };

/** Próximos bloques de atención (máximo `maxDias` días hacia adelante). */
export function bloquesProgramados(
  horarios: BloqueHorario[],
  desde: Date,
  maxDias = 14,
): BloqueProgramado[] {
  if (!Array.isArray(horarios)) return [];

  const reloj = relojZonaCentro(desde);
  const bloques: BloqueProgramado[] = [];

  for (let diasAdelante = 0; diasAdelante <= maxDias; diasAdelante += 1) {
    const fechaBuscada = new Date(reloj);
    fechaBuscada.setDate(reloj.getDate() + diasAdelante);
    const nombreDelDia = NOMBRES_DE_DIA[fechaBuscada.getDay()];

    const bloque = horarios.find(
      (item) => item.dia === nombreDelDia && bloqueUtilizable(item),
    );
    if (!bloque) continue;

    const [horaInicio, minutoInicio] = bloque.horaInicio.split(":").map(Number);
    const [horaFin, minutoFin] = bloque.horaFin.split(":").map(Number);

    const inicio = new Date(fechaBuscada);
    inicio.setHours(horaInicio, minutoInicio, 0, 0);
    const fin = new Date(fechaBuscada);
    fin.setHours(horaFin, minutoFin, 0, 0);

    bloques.push({
      inicio: deRelojZonaCentro(inicio),
      fin: deRelojZonaCentro(fin),
    });
  }

  return bloques;
}

/**
 * RQNF24: momento límite (fin del siguiente bloque de atención del vendedor)
 * para que confirme el comprobante antes de que se cancele y reembolse.
 * Devuelve null si el vendedor no tiene bloques agendados.
 */
export function finDelSiguienteBloqueDeAtencion(
  horarios: BloqueHorario[],
  desde: Date,
): Date | null {
  const referencia = new Date(
    desde.getTime() + MINUTOS_MINIMOS_DE_ATENCION * 60000,
  );
  const proximo = bloquesProgramados(horarios, desde).find(
    (bloque) => bloque.fin.getTime() >= referencia.getTime(),
  );
  return proximo?.fin ?? null;
}

/**
 * RQNF31: fin de los próximos `cantidad` bloques de atención (por defecto 3).
 * Si pasa ese momento sin ningún mensaje, la transacción se cancela y se
 * reembolsa. Devuelve null si no hay bloques suficientes agendados.
 */
export function finDeBloquesDeAtencion(
  horarios: BloqueHorario[],
  desde: Date,
  cantidad = 3,
): Date | null {
  const referencia = new Date(
    desde.getTime() + MINUTOS_MINIMOS_DE_ATENCION * 60000,
  );
  const disponibles = bloquesProgramados(horarios, desde, 21).filter(
    (bloque) => bloque.fin.getTime() >= referencia.getTime(),
  );

  if (disponibles.length < cantidad) return null;
  return disponibles[cantidad - 1].fin;
}

export function obtenerTextoDeProximoBloque(
  horarios: BloqueHorario[],
  fechaActual: Date,
): string | null {
  if (!Array.isArray(horarios)) return null;

  const reloj = relojZonaCentro(fechaActual);
  const minutosAhora = reloj.getHours() * 60 + reloj.getMinutes();

  for (let diasAdelante = 0; diasAdelante <= 7; diasAdelante += 1) {
    const fechaBuscada = new Date(reloj);
    fechaBuscada.setDate(reloj.getDate() + diasAdelante);
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
