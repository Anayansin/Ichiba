/**
 * Carga del SDK de MercadoPago (v2) para montar el Payment Brick en la
 * página del producto (Checkout API). El script se pide una sola vez aunque
 * el comprador intente pagar varias veces.
 */

export type PagoBrickFormData = {
  token?: string;
  payment_method_id?: string;
  issuer_id?: string | number;
  installments?: number;
  payer?: {
    email?: string;
    identification?: { type?: string; number?: string };
  };
};

export type ConfiguracionPaymentBrick = {
  initialization: {
    amount: number;
    payer?: { email?: string };
  };
  customization?: Record<string, unknown>;
  callbacks?: {
    onReady?: () => void;
    onSubmit?: (datos: {
      selectedPaymentMethod?: string;
      formData: PagoBrickFormData;
    }) => void | Promise<void>;
    onError?: (error: unknown) => void;
  };
};

type ControladorBrick = { unmount: () => void };

type ConstructorMercadoPago = new (
  llavePublica: string,
  opciones?: { locale?: string },
) => {
  bricks: () => {
    create: (
      tipo: "payment",
      contenedor: string,
      configuracion: ConfiguracionPaymentBrick,
    ) => Promise<ControladorBrick>;
  };
};

declare global {
  interface Window {
    MercadoPago?: ConstructorMercadoPago;
  }
}

const URL_SDK = "https://sdk.mercadopago.com/js/v2";

let promesaDeCarga: Promise<void> | null = null;

/** Carga el SDK una sola vez y resuelve cuando `window.MercadoPago` existe. */
export function cargarSdkMercadoPago(): Promise<void> {
  if (window.MercadoPago) {
    return Promise.resolve();
  }

  if (!promesaDeCarga) {
    promesaDeCarga = new Promise<void>((resolver, rechazar) => {
      const script = document.createElement("script");
      script.src = URL_SDK;
      script.async = true;
      script.onload = () => {
        if (window.MercadoPago) resolver();
        else rechazar(new Error("El SDK de MercadoPago cargó sin inicializarse"));
      };
      script.onerror = () => {
        // Permite reintentar si la red falló en este intento.
        promesaDeCarga = null;
        rechazar(new Error("No se pudo cargar el SDK de MercadoPago"));
      };
      document.head.appendChild(script);
    });
  }

  return promesaDeCarga;
}

/** Crea el Payment Brick dentro del contenedor indicado. */
export async function crearPaymentBrick(
  llavePublica: string,
  contenedor: string,
  configuracion: ConfiguracionPaymentBrick,
): Promise<ControladorBrick> {
  await cargarSdkMercadoPago();

  if (!window.MercadoPago) {
    throw new Error("El SDK de MercadoPago no está disponible");
  }

  const mp = new window.MercadoPago(llavePublica, { locale: "es-MX" });
  return mp.bricks().create("payment", contenedor, configuracion);
}
