export const COMISION_PLATAFORMA_PORCENTAJE = 5;
export const IVA_PORCENTAJE = 16;

export const COMISION_PLATAFORMA_CON_IVA_PORCENTAJE =
  COMISION_PLATAFORMA_PORCENTAJE * (1 + IVA_PORCENTAJE / 100);

export const COMISION_PLATAFORMA_TEXTO =
  "5% + IVA (5.8% en total)";

export const COMISION_PAYPAL_TEXTO =
  "PayPal: aproximadamente 3.95% + $4.00 MXN por transacción, más IVA";

export const NOTA_COMISIONES_VENDEDOR =
  "Ichiba cobra 5% + IVA (5.8% total) de comisión por uso de la plataforma, " +
  "más la comisión por transacción de PayPal (≈ 3.95% + " +
  "$4.00 MXN, más IVA), que puede " +
  "variar según el método, el plazo de disposición y las promociones. Esas " +
  "comisiones se descuentan del monto que recibes al confirmar la entrega.";
