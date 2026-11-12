/**
 * Comisión de Ichiba y su desglose fiscal.
 *
 * La política comercial aprobada es 5 % de comisión de plataforma más el IVA
 * (16 %). El equivalente sobre el precio de venta es 5.8 %. Este módulo es la
 * única fuente de verdad: la usan la API de ventas, PayPal (platform fees) y
 * los reembolsos para que el vendedor nunca vea números distintos.
 */

export const COMISION_PORCENTAJE = 5;
export const IVA_PORCENTAJE = 16;

/** 5 % + IVA (16 %) = 5.8 % del precio de venta. */
export const COMISION_CON_IVA_PORCENTAJE =
  COMISION_PORCENTAJE * (1 + IVA_PORCENTAJE / 100);

export type DesgloseComision = {
  /** Porcentaje total informado al vendedor (5 % + IVA = 5.8 %). */
  porcentaje: number;
  /** Comisión de plataforma sin IVA (5 % del monto). */
  base: number;
  /** IVA de la comisión (16 % de la base). */
  iva: number;
  /** Total que retiene la plataforma (5.8 % del monto). */
  total: number;
  /** Monto que recibe el vendedor después de la comisión. */
  netoVendedor: number;
};

export type ComisionDeVenta = DesgloseComision & {
  /** true solo cuando la venta se completó y el dinero se liberó. */
  cobrada: boolean;
  /** true si la venta se reembolsó o canceló: no se cobra comisión. */
  reembolsada: boolean;
};

function redondear2(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

function montoValido(monto: number): number {
  return Number.isFinite(monto) && monto > 0 ? monto : 0;
}

/**
 * Calcula la comisión sobre el precio de venta. Los importes se redondean a
 * centavos en cada concepto para que base + IVA coincida con el total que se
 * muestra y con el que se envía a PayPal.
 */
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

/**
 * Traduce el estado del escrow a la comisión que corresponde cobrar.
 *
 * - `completada`: ya se liberó el dinero, la comisión se cobró.
 * - `reembolsada` / `cancelada`: no se cobra comisión.
 * - Cualquier estado anterior a la entrega: es una estimación; todavía no se
 *   descuenta nada.
 */
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
