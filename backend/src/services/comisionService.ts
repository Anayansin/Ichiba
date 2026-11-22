export const COMISION_PORCENTAJE = 5;
export const IVA_PORCENTAJE = 16;

export const COMISION_CON_IVA_PORCENTAJE =
  COMISION_PORCENTAJE * (1 + IVA_PORCENTAJE / 100);

export type DesgloseComision = {
  porcentaje: number;
  base: number;
  iva: number;
  total: number;
  netoVendedor: number;
};

export type ComisionDeVenta = DesgloseComision & {
  cobrada: boolean;
  reembolsada: boolean;
};

function redondear2(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

function montoValido(monto: number): number {
  return Number.isFinite(monto) && monto > 0 ? monto : 0;
}

export function calcularComision(monto: number): DesgloseComision {
  const precio = montoValido(monto);
  const base = redondear2((precio * COMISION_PORCENTAJE) / 100);
  const iva = redondear2((base * IVA_PORCENTAJE) / 100);
  const total = redondear2(base + iva);

  return {
    porcentaje: redondear2(COMISION_CON_IVA_PORCENTAJE),
    base,
    iva,
    total,
    netoVendedor: redondear2(Math.max(0, precio - total)),
  };
}

export function comisionDeVenta(
  monto: number,
  estado: string,
): ComisionDeVenta {
  const precio = montoValido(monto);

  if (estado === "reembolsada" || estado === "cancelada") {
    return {
      porcentaje: redondear2(COMISION_CON_IVA_PORCENTAJE),
      base: 0,
      iva: 0,
      total: 0,
      netoVendedor: 0,
      cobrada: false,
      reembolsada: true,
    };
  }

  return {
    ...calcularComision(precio),
    cobrada: estado === "completada",
    reembolsada: false,
  };
}
