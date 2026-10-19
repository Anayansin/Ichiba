/**
 * Comisiones que el vendedor debe conocer antes de publicar y cobrar.
 *
 * - Ichiba cobra 5% de comisión por uso de la plataforma, más el IVA (16%).
 * - Cada pasarela cobra además su propia comisión por transacción, que es
 *   aproximada y puede cambiar según el método de pago y las promociones
 *   (por ejemplo, meses sin intereses).
 *
 * Se muestran tanto en el registro como al publicar un producto y en las
 * políticas de privacidad.
 */
export const COMISION_PLATAFORMA_PORCENTAJE = 5;
export const IVA_PORCENTAJE = 16;

/** 5% + IVA (16%): 5.8% total sobre el precio de venta. */
export const COMISION_PLATAFORMA_CON_IVA_PORCENTAJE =
  COMISION_PLATAFORMA_PORCENTAJE * (1 + IVA_PORCENTAJE / 100);

export const COMISION_PLATAFORMA_TEXTO =
  "5% + IVA (5.8% en total)";

export const COMISION_PAYPAL_TEXTO =
  "PayPal: aproximadamente 3.95% + $4.00 MXN por transacción, más IVA";

export const COMISION_MERCADOPAGO_TEXTO =
  "Mercado Pago: aproximadamente 3.49% + $4.00 MXN por transacción aprobada, más IVA";

export const NOTA_COMISIONES_VENDEDOR =
  "Ichiba cobra 5% + IVA (5.8% total) de comisión por uso de la plataforma, " +
  "más la comisión por transacción de tu método de pago (PayPal ≈ 3.95% + " +
  "$4.00 MXN; Mercado Pago ≈ 3.49% + $4.00 MXN, ambos más IVA), que puede " +
  "variar según el método, el plazo de disposición y las promociones. Esas " +
  "comisiones se descuentan del monto que recibes al confirmar la entrega.";
